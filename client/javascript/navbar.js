import fetchCompanyDetails from "../api/loadCompanyInfo.js";

document.addEventListener("DOMContentLoaded", () => {
  fetch("/components/navbar.html")
    .then((res) => res.text())
    .then(async (data) => {
      document.getElementById("navbar-placeholder").innerHTML = data;
      await injectDynamicLogo();
      setupNavbarFeatures();
      try { document.dispatchEvent(new CustomEvent('navbar:loaded')); } catch (e) {}
    })
    .catch((error) => {
      console.error("Error loading navbar:", error);
    });
});

async function injectDynamicLogo() {
  try {
    const logoContainer = document.getElementById('logoContainer');
    if (!logoContainer) return;
    const details = await fetchCompanyDetails();
    if (!details) return; // keep fallback text
    // Prefer alt logo, then icon logo, else fallback text remains
    const markup = details.altLogoHtml || details.logoHtml;
    if (markup) {
      logoContainer.innerHTML = markup;
      logoContainer.classList.add('has-image');
    }
  } catch (e) {
    console.warn('Failed to inject company logo', e);
  }
}

function setupNavbarFeatures() {
  const navbar =
    document.querySelector("header") || document.getElementById("navbar");

  const hamburger = document.querySelector(".hamburger");
  const navLinks = document.querySelector(".nav-links");

  if (hamburger && navLinks) {
    hamburger.addEventListener("click", () => {
      hamburger.classList.toggle("active");
      navLinks.classList.toggle("active");
    });

    navLinks.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        hamburger.classList.remove("active");
        navLinks.classList.remove("active");
      });
    });

    document.addEventListener("click", (e) => {
      if (!navbar.contains(e.target)) {
        hamburger.classList.remove("active");
        navLinks.classList.remove("active");
      }
    });
  }

  const revealElements = document.querySelectorAll(".reveal-element");

  const revealOnScroll = () => {
    revealElements.forEach((element) => {
      const elementTop = element.getBoundingClientRect().top;
      const elementVisible = 150;

      if (elementTop < window.innerHeight - elementVisible) {
        element.classList.add("revealed");
      }
    });
  };

  const handleScroll = () => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

    if (scrollTop > 50) {
      navbar.classList.add("scrolled");
    } else {
      navbar.classList.remove("scrolled");
    }

    revealOnScroll();
  };

  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute("href"));
      if (target) {
        target.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    });
  });

  const observerOptions = {
    threshold: 0.1,
    rootMargin: "0px 0px -50px 0px",
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("revealed");
      }
    });
  }, observerOptions);

  document.querySelectorAll(".reveal-element").forEach((el) => {
    observer.observe(el);
  });

  window.addEventListener("scroll", () => {
    const navbar = document.querySelector(".navbar");
    if (navbar) {
      if (window.scrollY > 100) {
        navbar.style.background = "rgba(255, 255, 255, 0.98)";
      } else {
        navbar.style.background = "rgba(255, 255, 255, 0.95)";
      }
    }
  });

  const contactForm = navbar ? navbar.querySelector("form") : null;
  if (contactForm) {
    contactForm.addEventListener("submit", function (e) {
      e.preventDefault();

      const formData = new FormData(this);
      const name = formData.get("name");
      const email = formData.get("email");
      const phone = formData.get("phone");
      const message = formData.get("message");

      if (!name || !email || !message) {
        if (
          typeof window !== "undefined" &&
          typeof window.showAlert === "function"
        ) {
          window.showAlert("Please fill in all required fields.", "warning");
        } else {
          alert("Please fill in all required fields.");
        }
        return;
      }

      const button = this.querySelector("button");
      const originalText = button ? button.textContent : "";
      if (button) {
        button.textContent = "Sending...";
        button.disabled = true;
      }

      setTimeout(() => {
        if (
          typeof window !== "undefined" &&
          typeof window.showAlert === "function"
        ) {
          window.showAlert(
            "Thank you for your inquiry! We will contact you soon.",
            "success"
          );
        } else {
          alert("Thank you for your inquiry! We will contact you soon.");
        }
        this.reset();
        if (button) {
          button.textContent = originalText;
          button.disabled = false;
        }
      }, 2000);
    });
  }

  document.querySelectorAll(".property-card").forEach((card) => {
    card.addEventListener("mouseenter", function () {
      this.style.transform = "translateY(-15px) scale(1.02)";
    });

    card.addEventListener("mouseleave", function () {
      this.style.transform = "translateY(0) scale(1)";
    });
  });

  window.addEventListener("scroll", () => {
    const scrolled = window.pageYOffset;
    const parallax = document.querySelector(".hero");
    if (parallax) {
      const speed = scrolled * 0.5;
      parallax.style.transform = `translateY(${speed}px)`;
    }
  });
}
