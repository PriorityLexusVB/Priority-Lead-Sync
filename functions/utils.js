const getFirst = (prop) => (Array.isArray(prop) ? prop[0] : prop);
const getText = (prop) => {
  const val = getFirst(prop);
  return (val && typeof val === "object") ? (val["#text"] || "") : (val || "");
};

module.exports = { getFirst, getText };
