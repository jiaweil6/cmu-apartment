function calculatePercentages() {
    // Get all the slider values
    const sliders = document.querySelectorAll('.slider');
    let sum = 0;
    let values = [];
  
    // Calculate the sum of all slider values
    sliders.forEach(slider => {
      const value = parseInt(slider.value);
      values.push(value);
      sum += value;
    });
  
    // Calculate the percentage for each priority item and update the text and bar
    if (sum > 0) {
      values.forEach((value, index) => {
        const percentage = (value / sum * 100).toFixed(0);
        const priorityItemPercentage = document.querySelector(`#priority-${index + 1}`);
        const priorityBarItem = document.querySelector(`#priority-bar-${index + 1}`);
        const priorityLabel = priorityItemPercentage.previousElementSibling.previousElementSibling; // Assuming the label is two elements before the percentage span
  
        // Update the percentage text and color
        if (priorityItemPercentage) {
          priorityItemPercentage.textContent = `${percentage}%`;
          priorityItemPercentage.style.color = value > 0 ? 'black' : 'grey';
        }
  
        // Update the bar width and label color
        if (priorityBarItem) {
          priorityBarItem.style.width = `${percentage}%`;
          priorityLabel.style.color = value > 0 ? 'black' : 'grey';
        }
      });
    } else {
      // If the sum is 0, ensure all percentages and bars are reset
      document.querySelectorAll('.priority-item .percentage').forEach(item => {
        item.textContent = '0%';
        item.style.color = 'grey';
        item.previousElementSibling.previousElementSibling.style.color = 'grey'; // Reset label color
      });
      document.querySelectorAll('.priority-item .percentage-bar').forEach(bar => {
        bar.style.width = '0%';
      });
    }
  }  
  
// Make sure to call this function on page load and when the sliders are adjusted
document.addEventListener('DOMContentLoaded', calculatePercentages);

// Add event listeners to all sliders to recalculate percentages when they change
document.querySelectorAll('.slider').forEach(slider => {
    slider.addEventListener('input', calculatePercentages);
});

// Initial calculation
calculatePercentages();
