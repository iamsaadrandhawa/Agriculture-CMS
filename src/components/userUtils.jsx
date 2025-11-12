export const getCurrentUser = () => {
  const data = localStorage.getItem("userData");
  return data ? JSON.parse(data) : null;
};

export const logoutUser = () => {
  localStorage.removeItem("userData");
};
