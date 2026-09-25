package br.com.caronasolidaria;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.*;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import java.util.Map;
import java.util.stream.Collectors;

@RestControllerAdvice
class Errors {
    @ExceptionHandler(ApiException.class)
    ResponseEntity<?> api(ApiException ex) { return ResponseEntity.status(ex.status).body(Map.of("message", ex.getMessage())); }
    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<?> validation(MethodArgumentNotValidException ex) {
        return ResponseEntity.badRequest().body(Map.of("message", ex.getBindingResult().getFieldErrors().stream()
            .map(e -> e.getField() + ": " + e.getDefaultMessage()).collect(Collectors.joining("; "))));
    }
    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class})
    ResponseEntity<?> malformed(Exception ex) { return ResponseEntity.badRequest().body(Map.of("message", "Dados inválidos. Confira os campos informados.")); }
    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<?> duplicate(Exception ex) { return ResponseEntity.status(409).body(Map.of("message", "Já existe um cadastro com estes dados.")); }
}
