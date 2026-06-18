// Persistent in-game currency. Earned at the end of each run and spent in the
// skin shop.
const MONEY_KEY = "money";

let money = parseInt(localStorage.getItem(MONEY_KEY)) || 0;
let lastEarned = 0; // How much the most recent run paid out (for the UI).

export function getMoney() {
  return money;
}

export function addMoney(amount) {
  money += amount;
  localStorage.setItem(MONEY_KEY, money);
}

// Returns true if the player could afford it (and the money was deducted).
export function spendMoney(amount) {
  if (money < amount) return false;
  money -= amount;
  localStorage.setItem(MONEY_KEY, money);
  return true;
}

export function setLastEarned(amount) {
  lastEarned = amount;
}

export function getLastEarned() {
  return lastEarned;
}
