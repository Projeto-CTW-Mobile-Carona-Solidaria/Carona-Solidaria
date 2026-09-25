package br.com.caronasolidaria.desktop;
import com.fasterxml.jackson.databind.*;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;
final class ApiClient {
    private final HttpClient http=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    private final ObjectMapper json=new ObjectMapper(); private final String base; private String token;
    ApiClient(String url) {
        URI uri=URI.create(url.trim());
        if (uri.getHost()==null || uri.getUserInfo()!=null || (!"https".equals(uri.getScheme()) && !("http".equals(uri.getScheme()) && ("localhost".equals(uri.getHost()) || "127.0.0.1".equals(uri.getHost())))))
            throw new IllegalArgumentException("Use HTTPS para servidores remotos ou HTTP em localhost.");
        base=url.trim().replaceAll("/+$", "");
    }
    void token(String value) { token=value; }
    JsonNode request(String method,String path,Object body) throws Exception {
        HttpRequest.Builder req=HttpRequest.newBuilder(URI.create(base+path)).timeout(Duration.ofSeconds(20)).header("Accept","application/json");
        if (token!=null) req.header("Authorization","Bearer "+token);
        if (body!=null) req.header("Content-Type","application/json");
        req.method(method,body==null?HttpRequest.BodyPublishers.noBody():HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body)));
        HttpResponse<String> response=http.send(req.build(),HttpResponse.BodyHandlers.ofString());
        JsonNode result=response.body().isBlank()?json.nullNode():json.readTree(response.body());
        if (response.statusCode()>=400) throw new ApiError(response.statusCode(),result.path("message").asText("Falha na operação (HTTP "+response.statusCode()+")."));
        return result;
    }
    static final class ApiError extends Exception { final int status; ApiError(int status,String message) { super(message); this.status=status; } }
}
