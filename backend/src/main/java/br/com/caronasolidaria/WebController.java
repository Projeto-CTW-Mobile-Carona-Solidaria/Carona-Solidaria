package br.com.caronasolidaria;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/** Browser entry points; data access remains protected by the /api security rules. */
@Controller
class WebController {
    @GetMapping({"/", "/login", "/register", "/mine", "/offer", "/vehicle", "/profile", "/group/{id}", "/journey/{id}"})
    String mobile() {
        return "forward:/index.html";
    }

    @GetMapping("/admin")
    String adminRedirect() {
        return "redirect:/admin/";
    }

    @GetMapping("/admin/")
    String admin() {
        return "forward:/admin/index.html";
    }
}
