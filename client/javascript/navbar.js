document.addEventListener("DOMContentLoaded", () => {
  
  fetch("/components/navbar.html")
    .then((res) => res.text())
    .then((data) => {
      document.getElementById("navbar-placeholder").innerHTML = data;
      setupNavbarFeatures();
    })
    .catch((error) => {
      console.error("Error loading navbar:", error);
    });
});

function setupNavbarFeatures() {
  const navbar =
    document.querySelector("header") || document.getElementById("navbar");

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
      alert("Please fill in all required fields.");
      return;
    }

    
    const button = this.querySelector("button");
    const originalText = button ? button.textContent : '';
    if (button) {
      button.textContent = "Sending...";
      button.disabled = true;
    }

    setTimeout(() => {
      alert("Thank you for your inquiry! We will contact you soon.");
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
    const speed = scrolled * 0.5;
    parallax.style.transform = `translateY(${speed}px)`;
  });
}
