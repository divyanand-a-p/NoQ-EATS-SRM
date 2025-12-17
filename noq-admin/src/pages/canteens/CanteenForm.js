document.addEventListener("DOMContentLoaded", () => {
  const prefixInput = document.getElementById("orderPrefix");

  if (!prefixInput) return;

  // Force uppercase while typing
  prefixInput.addEventListener("input", () => {
    prefixInput.value = prefixInput.value.toUpperCase();
  });
});

function validateOrderPrefix() {
  const prefixInput = document.getElementById("orderPrefix");

  if (!prefixInput) {
    alert("Order prefix field not found");
    return null;
  }

  const orderPrefix = prefixInput.value.trim().toUpperCase();

  if (!/^[A-Z]{2}$/.test(orderPrefix)) {
    alert("Order prefix must be exactly 2 capital letters (A–Z)");
    return null;
  }

  return orderPrefix;
}
