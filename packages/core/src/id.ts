export function createID() {
  const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

  let id = "";
  for (let i = 0; i < 6; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    id += charset[randomIndex];
  }

  return id;
}
