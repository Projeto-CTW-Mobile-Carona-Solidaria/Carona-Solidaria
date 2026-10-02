package br.com.caronasolidaria;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import java.util.concurrent.locks.ReentrantLock;
import static br.com.caronasolidaria.ApiException.*;

@RestController @RequestMapping("/api/navigation")
class NavigationController {
    record Geo(@DecimalMin("-90") @DecimalMax("90") double lat,@DecimalMin("-180") @DecimalMax("180") double lng) {}
    record Points(@NotNull @Size(min=2,max=10) List<@NotNull @Valid Geo> points) {}
    record Address(@NotBlank @Size(min=4,max=300) String address) {}
    record Place(double lat,double lng,String displayName) {}
    record Cached(Place place,Instant at) {}
    private final HttpClient client=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
    private final ObjectMapper json;
    private final String geocodingUrl,routeUrl,userAgent;
    private final ReentrantLock geocodingLock=new ReentrantLock();
    private final Map<String,Cached> cache=new java.util.concurrent.ConcurrentHashMap<>();
    private long lastLookup;
    NavigationController(ObjectMapper json,@Value("${app.navigation.geocoding-url}") String geocodingUrl,
        @Value("${app.navigation.route-url}") String routeUrl,@Value("${app.navigation.user-agent}") String userAgent) {
        this.json=json;this.geocodingUrl=geocodingUrl;this.routeUrl=routeUrl.replaceAll("/$","");this.userAgent=userAgent;
    }
    // Only explicit searches; one upstream request at a time, <=1/s across the application.
    @PostMapping("/geocode") Place geocode(@Valid @RequestBody Address input) {
        String address=input.address().trim().replaceAll("\\s+"," ");String key=address.toLowerCase(Locale.ROOT);
        Cached found=cache.get(key);if(found!=null&&found.at().plusSeconds(86400).isAfter(Instant.now())) return found.place();
        if(!geocodingLock.tryLock()) throw new ApiException(HttpStatus.TOO_MANY_REQUESTS,"A busca de endereços está ocupada. Tente novamente em alguns segundos.");
        try {
            long wait=1100-(System.currentTimeMillis()-lastLookup);if(wait>0) Thread.sleep(wait);
            lastLookup=System.currentTimeMillis();
            JsonNode data=read(geocodingUrl+"?format=jsonv2&countrycodes=br&limit=1&accept-language=pt-BR&q="+URLEncoder.encode(address,StandardCharsets.UTF_8));
            if(!data.isArray()||data.isEmpty()) throw new ApiException(HttpStatus.NOT_FOUND,"Ponto não encontrado. Informe rua, bairro, cidade e estado, ou use coordenadas.");
            JsonNode place=data.get(0);double lat=Double.parseDouble(place.path("lat").asText()),lng=Double.parseDouble(place.path("lon").asText());geo(new Geo(lat,lng));
            Place result=new Place(lat,lng,place.path("display_name").asText(address));
            cache.entrySet().removeIf(e -> e.getValue().at().plusSeconds(86400).isBefore(Instant.now()));
            if(cache.size()>=1000) cache.clear();cache.put(key,new Cached(result,Instant.now()));return result;
        } catch(InterruptedException e) { Thread.currentThread().interrupt();throw unavailable(); }
        catch(NumberFormatException e) { throw unavailable(); }
        finally { geocodingLock.unlock(); }
    }
    @PostMapping("/route") JourneyDtos.Segment route(@Valid @RequestBody Points input) {
        if(input.points().size()!=2) throw bad("Cada trecho precisa de origem e destino.");
        JsonNode data=read(routeUrl+"/route/v1/driving/"+coordinates(input)+"?overview=full&geometries=geojson&steps=false");
        if(!"Ok".equals(data.path("code").asText())||data.path("routes").isEmpty()) throw bad("Não foi encontrada uma rota entre esses pontos.");
        JsonNode route=data.path("routes").get(0);List<List<Double>> geometry=new ArrayList<>();
        for(JsonNode point:route.path("geometry").path("coordinates")) {
            if(point.size()<2||!point.get(0).isNumber()||!point.get(1).isNumber()) throw unavailable();
            Geo g=new Geo(point.get(1).asDouble(),point.get(0).asDouble());geo(g);geometry.add(List.of(g.lat(),g.lng()));
        }
        if(geometry.size()<2||geometry.size()>10000) throw bad("Trecho fora do limite de tamanho. Use pontos mais próximos.");
        double meters=route.path("distance").asDouble(-1),seconds=route.path("duration").asDouble(-1);
        if(!Double.isFinite(meters)||!Double.isFinite(seconds)||meters<0||seconds<0) throw unavailable();
        return new JourneyDtos.Segment(0,1,meters,seconds,geometry);
    }
    @PostMapping("/durations") JsonNode durations(@Valid @RequestBody Points input) {
        JsonNode data=read(routeUrl+"/table/v1/driving/"+coordinates(input)+"?annotations=duration");
        if(!"Ok".equals(data.path("code").asText())||!data.path("durations").isArray()) throw bad("Não foi possível otimizar as paradas. Tente manter a ordem informada.");
        return data.path("durations");
    }
    private String coordinates(Points input) {
        return String.join(";",input.points().stream().map(p -> {geo(p);return p.lng()+","+p.lat();}).toList());
    }
    private void geo(Geo p) { if(!Double.isFinite(p.lat())||!Double.isFinite(p.lng())||Math.abs(p.lat())>90||Math.abs(p.lng())>180) throw bad("Coordenadas inválidas."); }
    private JsonNode read(String url) {
        try {
            HttpRequest request=HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(7)).header("User-Agent",userAgent).header("Accept","application/json").GET().build();
            HttpResponse<String> response=client.send(request,HttpResponse.BodyHandlers.ofString());
            if(response.statusCode()==429) throw new ApiException(HttpStatus.TOO_MANY_REQUESTS,"Serviço de mapas ocupado. Aguarde e tente novamente.");
            if(response.statusCode()!=200||response.body().length()>4_000_000) throw unavailable();
            JsonNode data=json.readTree(response.body());
            if(data==null||data.isNull()||(!data.isObject()&&!data.isArray())) throw unavailable();
            return data;
        } catch(InterruptedException e) {Thread.currentThread().interrupt();throw unavailable();}
        catch(java.io.IOException|IllegalArgumentException e) {throw unavailable();}
    }
    private ApiException unavailable() {return new ApiException(HttpStatus.BAD_GATEWAY,"O serviço de mapas não respondeu. Tente novamente mais tarde.");}
}
