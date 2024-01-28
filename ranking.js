// Example function to filter apartments based on user preferences
function filterApartments(apartments, preferences) {
  return apartments.filter(apartment => {
    return Object.keys(preferences).every(preference => {
      return preferences[preference] ? apartment[preference] === 'Yes' : true;
    });
  });
}

function calculateRankings(apartments, importance) {
  let totalImportance = Object.values(importance).reduce((a, b) => a + b, 0);
  let normalizedImportance = {};
  Object.keys(importance).forEach(key => {
    normalizedImportance[key] = importance[key] / totalImportance;
  });

  apartments.forEach(apartment => {
    apartment.score = 0;
    Object.keys(normalizedImportance).forEach(key => {
      apartment.score += apartment[key] * normalizedImportance[key];
    });
  });

  return apartments.sort((a, b) => b.score - a.score);
}
