import fetchCompanyDetails from "../api/loadCompanyInfo.js";

fetch("/components/footer.html")
  .then((res) => res.text())
  .then((data) => {
    document.getElementById("footer-placeholder").innerHTML = data;
    setDynamicFooterContent();
  })
  .catch((error) => {
    console.error("Error loading footer:", error);
  });
  
async function setDynamicFooterContent() {
  const company = await fetchCompanyDetails();
  if (!company) return;

  const nameEl = document.getElementById("ft-dynamic-company-name");
  if (nameEl) nameEl.textContent = company.company_name || "Ambulo Properties";
  const descEl = document.getElementById("ft-dynamic-company-description");
  if (descEl)
    descEl.textContent =
      company.business_desc ||
      "Your trusted partner for premium commercial spaces in Silang, Cavite.";
  const addressEl = document.getElementById("ft-dynamic-company-address");
  if (addressEl)
    addressEl.innerHTML = `<i class="fa-solid fa-location-dot"></i> ${
      company.street_address || ""
    }, ${company.city || ""}, ${company.province || ""}, ${
      company.country || ""
    }`;
  const phoneEl = document.getElementById("ft-dynamic-company-phone");
  const altPhoneEl = document.getElementById("ft-dynamic-company-alt-phone");
  if (phoneEl && altPhoneEl) {
    phoneEl.innerHTML = `<i class="fa-solid fa-phone"></i> ${
      company.phone_number || ""
    } | <span id="ft-dynamic-company-alt-phone">${
      company.alt_phone_number || ""
    }</span>`;
  }
  const emailEl = document.getElementById("ft-dynamic-company-email");
  if (emailEl)
    emailEl.innerHTML = `<i class="fa-solid fa-envelope"></i> ${
      company.email || ""
    }`;
}
