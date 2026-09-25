package br.com.caronasolidaria;
import org.springframework.http.HttpStatus;
public class ApiException extends RuntimeException {
    final HttpStatus status;
    ApiException(HttpStatus status, String message) { super(message); this.status = status; }
    static ApiException bad(String message) { return new ApiException(HttpStatus.BAD_REQUEST, message); }
    static ApiException forbidden() { return new ApiException(HttpStatus.FORBIDDEN, "Você não tem permissão para esta operação."); }
    static ApiException missing() { return new ApiException(HttpStatus.NOT_FOUND, "Registro não encontrado."); }
    static ApiException conflict(String message) { return new ApiException(HttpStatus.CONFLICT, message); }
}
