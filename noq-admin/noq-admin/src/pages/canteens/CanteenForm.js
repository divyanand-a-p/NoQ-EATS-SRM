const prefixInput = document.getElementById("orderPrefix");

const orderPrefix = prefixInput.value.trim().toUpperCase();

if (!/^[A-Z]{2}$/.test(orderPrefix)) {
  alert("Order prefix must be exactly 2 capital letters (A–Z)");
  return;
}
prefixInput.addEventListener("input", () => {
  prefixInput.value = prefixInput.value.toUpperCase();
});
