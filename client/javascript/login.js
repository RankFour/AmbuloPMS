import fetchCompanyDetails from "../api/loadCompanyInfo.js";


const API_BASE_URL = "/api/v1/users";

document.addEventListener("DOMContentLoaded", function () {
  const loginForm = document.getElementById("loginForm");
  const passwordField = document.getElementById("passwordField");
  const toggleButton = document.getElementById("toggleButton");
  const toggleIcon = document.getElementById("toggleIcon");

  toggleButton.addEventListener("click", function () {
    if (passwordField.type === "password") {
      passwordField.type = "text";
      toggleIcon.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
    } else {
      passwordField.type = "password";
      toggleIcon.innerHTML = '<i class="fa-solid fa-eye"></i>';
    }
  });

  loginForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const email = document.querySelector('input[type="email"]').value;
    const password = document.querySelector('input[type="password"]').value;

    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error("Response is not JSON:", await response.text());
        if (typeof window !== 'undefined' && typeof window.showAlert === 'function') {
          window.showAlert("Server error - please try again", 'error');
        } else {
          alert("Server error - please try again");
        }
        return;
      }

      if (response.ok) {
        localStorage.setItem("user", JSON.stringify(data.user));

        if (data.user.role === "ADMIN") {
          window.location.href = "adminDashboard.html";
        } else {
          window.location.href = "tenantDashboard.html";
        }
      } else {
        if (typeof window !== 'undefined' && typeof window.showAlert === 'function') {
          window.showAlert(data.message || "Login failed", 'error');
        } else {
          alert(data.message || "Login failed");
        }
      }
    } catch (error) {
      console.error("Login error:", error);
      if (typeof window !== 'undefined' && typeof window.showAlert === 'function') {
        window.showAlert("An error occurred during login", 'error');
      } else {
        alert("An error occurred during login");
      }
    }
  });
});

async function setDynamicCompanyDetails() {
  const data = await fetchCompanyDetails();
  if(!data || !data[0]) return;
  const companyDetails = data[0];

  
  const brandName = document.getElementById("dynamic-company-name");
  if (brandName) brandName.textContent = companyDetails.company_name || "Your Company";

  
  const brandDesc = document.getElementById("dynamic-company-desc");
  if (brandDesc) brandDesc.textContent = companyDetails.business_desc || "Your trusted partner in property management.";

  
  const logoImg = document.getElementById("dynamic-logo");
  if (logoImg) logoImg.src = companyDetails.icon_logo_url || "/assets/logo-property.png";

  
  const favicon = document.getElementById("dynamic-favicon");
  if (favicon) favicon.href = companyDetails.icon_logo_url || "/assets/logo-property.png";

  
  document.title = `${companyDetails.company_name || "Ambulo Properties"} Login`;

}

document.addEventListener("DOMContentLoaded", setDynamicCompanyDetails);