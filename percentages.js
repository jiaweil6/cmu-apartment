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


function getFilteredApartments() {
  const hasInUnitLaundry = document.getElementById('washerDryer').checked;
  const hasFitnessRoom = document.getElementById('fitnessRoom').checked;
  const hasParking = document.getElementById('parking').checked;
  const isOpenToUndergrad = document.getElementById('studentType').value === 'undergraduate';
  
  // Get selected locations
  const selectedLocations = Array.from(document.querySelectorAll('.location-checkbox:checked'))
                                    .map(checkbox => checkbox.value);

  return apartmentsData.filter(apartment => {
    const locationMatch = selectedLocations.length === 0 || selectedLocations.includes(apartment.Location.toLowerCase());
    return locationMatch &&
           (!hasInUnitLaundry || apartment["In-unit Laundry"] === "Yes") &&
           (!hasFitnessRoom || apartment["Fitness"] === "Yes") &&
           (!hasParking || apartment["Parking"] === "Yes") &&
           (!isOpenToUndergrad || apartment["Open to undergrad"] === "Yes");
  });
}

function setupCollapseBehavior() {
  const collapseElements = document.querySelectorAll('.collapse');
  
  collapseElements.forEach(collapseEl => {
    // Listen to the show.bs.collapse event which triggers when the collapse is opened
    $(collapseEl).on('show.bs.collapse', function () {
      collapseElements.forEach(el => {
        if (el !== collapseEl) {
          // Collapse any other open elements
          $(el).collapse('hide');
        }
      });
    });
  });
}

function displayRankings() {
  const sliders = document.querySelectorAll('.slider');
  const sliderValues = Array.from(sliders).map(slider => parseInt(slider.value) / 100);
  const selectedRoomType = document.getElementById('bedrooms').value;
  
  // Check if all slider values are 0
  const allSlidersAtZero = sliderValues.every(value => value === 0);
  const rankingsList = document.getElementById('rankingsList');

  if (allSlidersAtZero) {
    // Display message if all sliders are at 0
    rankingsList.innerHTML = '<h2 class="warning">Select Your Priorities for Your Dream Off-Campus Residence!</h2>';
    return;
  }

  const filteredApartments = getFilteredApartments();
  const scoredApartments = filteredApartments.map(apartment => {
    let score = 0;
    let priceScore = 0;

    // Determine price based on selected room type
    switch (selectedRoomType) {
      case 'studio':
        priceScore = apartment["Studio Price"];
        break;
      case '1':
        priceScore = apartment["1BR Price"];
        break;
      case '2':
        priceScore = apartment["2BR Price"];
        break;
      case '3':
        priceScore = apartment["3BR Price"];
        break;
    }

    // If price score is above 1, it means not available
    if (priceScore > 1) {
      return { ...apartment, score: -1 }; // Set negative score for unavailable apartments
    }

    score += sliderValues[0] * apartment["Bus Duration"]; // Quick Commute
    score += sliderValues[1] * apartment["Distance in miles"]; // Close to School
    score += sliderValues[2] * priceScore; // Low Price (inverted)
    score += sliderValues[3] * apartment["Rating (Google Maps)"]; // Good Rating
    score += sliderValues[4] * apartment["Year Built"]; // New Building

    return { ...apartment, score };
  });

  // Filter out unavailable apartments and sort the rest by score
  const availableApartments = scoredApartments.filter(apartment => apartment.score >= 0);
  availableApartments.sort((a, b) => b.score - a.score);

  // Take top 5 apartments
  const topApartments = availableApartments.slice(0, 5);

  // Display top 5 apartments
  rankingsList.innerHTML = ''; // Clear previous results
  availableApartments.forEach((apartment, index) => {
    const apartmentElement = document.createElement('div');
    apartmentElement.className = 'card mb-3';
    const detailsId = `apartmentDetails${index}`;
    

    apartmentElement.innerHTML = `
      <div class="card-body">
        <a href="#${detailsId}" class="card-title d-flex justify-content-between align-items-center" data-toggle="collapse">
          ${index + 1}. ${apartment.Name}
          <i class="fas fa-chevron-down"></i>
        </a>
        <div class="collapse" id="${detailsId}">
          <div class="card card-body">
            <p>Address: ${apartment.address}</p>
            <p>Phone Number: ${apartment["phone number"]}</p>
            <p>Studio Price: $${apartment["Price0"]}</p>
            <p>1 Bedroom Price: $${apartment["Price1"]}</p>
            <p>2 Bedrooms Price: $${apartment["Price2"]}</p>
            <p>3 Bedrooms Price: $${apartment["Price3"]}</p>
            <a href="${apartment["Website"]}" target="_blank" rel="noopener noreferrer">Website</a>
            <a href="map.html">View on Map</a>
            <br>
            <img src="${apartment["Image"]}" alt="image">
            <!-- Additional details can be added here -->
          </div>
        </div>
      </div>
    `;

    rankingsList.appendChild(apartmentElement);
  });
  setupCollapseBehavior();
}


function toggleIcon(element, detailsId) {
  const detailsElement = document.getElementById(detailsId);
  if (detailsElement.classList.contains('show')) {
    element.innerHTML = '<i class="fas fa-chevron-down"></i> View Details';
  } else {
    element.innerHTML = '<i class="fas fa-chevron-up"></i> View Details';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.card-title').forEach(title => {
    const icon = title.querySelector('i');
    if (icon) {
      title.addEventListener('click', () => {
        icon.classList.toggle('icon-rotate');
      });
    }
  });
});


// For sliders and checkboxes
document.querySelectorAll('.slider, .amenity-checkbox, .location-checkbox').forEach(element => {
  element.addEventListener('input', () => {
    calculatePercentages();
    displayRankings();
  });
});

// For dropdowns
document.querySelectorAll('#bedrooms, #studentType').forEach(element => {
  element.addEventListener('change', () => {
    calculatePercentages();
    displayRankings();
  });
});


// Initial call to display rankings
document.addEventListener('DOMContentLoaded', () => {
  displayRankings();
});


const apartmentsData = [
  {
    "Name": "SkyVue",
    "Studio Price": 0.27,
    "1BR Price": 0.25,
    "2BR Price": 0.35,
    "3BR Price": 0.5,
    "Location": "Oakland",
    "In-unit Laundry": "Yes",
    "Fitness": "Yes",
    "Open to undergrad": "Yes",
    "Parking": "Yes",
    "Distance in miles": 0.53,
    "Bus Duration": 0.88,
    "Rating (Google Maps)": 0.29,
    "Year Built": 0.71,
    "phone number": "412-281-4445",
    "address": "3333 Forbes Ave, Pittsburgh, PA 15213",
    "Price0": 1880,
    "Price1": 2150,
    "Price2": 2650,
    "Price3": 3450,
    "Image": "https://www.mapletree.com.sg/~/media/Our%20Portfolio/USA/SkyVue/Skyvue%20website.jpg?h=403",
    "Website": "https://www.skyvueapts.com/",
    "Latitude": "40.4391042",
    "Longitude": "-79.9643248"
  },
  {
    "Name": "One on Center",
    "Studio Price": 0.18,
    "1BR Price": 0.13,
    "2BR Price": 0.18,
    "3BR Price": 0.17,
    "Location": "Oakland",
    "In-unit Laundry": "Yes",
    "Fitness": "Yes",
    "Open to undergrad": "Yes",
    "Parking": "Yes",
    "Distance in miles": 0.76,
    "Bus Duration": 0.56,
    "Rating (Google Maps)": 0.06,
    "Year Built": 0.82,
    "phone number": "412-906-9552",
    "address": "4500 Centre Ave, Pittsburgh, PA 15213",
    "Price0": 2060,
    "Price1": 2300,
    "Price2": 3340,
    "Price3": 4350,
    "Image": "https://lh3.googleusercontent.com/p/AF1QipMId7VafOAff6QhE6qJ4owtlEL3JAxILPNw6usi=s1360-w1360-h1020",
    "Website": "https://www.oneoncentre.com/",
    "Latitude": "40.451418",
    "Longitude": "-79.9557349"
  },
  {
    "Name": "The Bridge on Forbes Apartments",
    "Studio Price": 0.73,
    "1BR Price": 0.38,
    "2BR Price": 0.41,
    "3BR Price": 0.33,
    "Location": "Oakland",
    "In-unit Laundry": "Yes",
    "Fitness": "Yes",
    "Open to undergrad": "Yes",
    "Parking": "Yes",
    "Distance in miles": 0.65,
    "Bus Duration": 0.88,
    "Rating (Google Maps)": 0.94,
    "Year Built": 0.94,
    "phone number": "412-688-6279",
    "address": "3423 Forbes Ave, Pittsburgh, PA 15213",
    "Price0": 1500,
    "Price1": 1900,
    "Price2": 2500,
    "Price3": 3750,
    "Image": "https://www.pc.pitt.edu/sites/default/files/bridge-header.jpg",
    "Website": "https://thebridgeonforbes.com/",
    "Latitude": "40.4388382",
    "Longitude": "-79.9635423"
  },
  {
    "Name": "Sherwood Tower Aparments",
    "Studio Price": 1.09,
    "1BR Price": 0.5,
    "2BR Price": 0.53,
    "3BR Price": 0.83,
    "Location": "Oakland",
    "In-unit Laundry": "No",
    "Fitness": "Yes",
    "Open to undergrad": "No",
    "Parking": "Yes",
    "Distance in miles": 0.88,
    "Bus Duration": 0.56,
    "Rating (Google Maps)": 0.82,
    "Year Built": 0.47,
    "phone number": "412-688-6232",
    "address": "230 N Craig St, Pittsburgh, PA 15213",
    "Price0": "N/A",
    "Price1": 1800,
    "Price2": 2300,
    "Price3": 2700,
    "Image": "https://rentpath-res.cloudinary.com/$img_current/t_3x2_webp_xl/t_unpaid/b2fbab3b7a944e1db2a570fc308da386",
    "Website": "https://www.sherwoodtowers.com/",
    "Latitude": "40.4510414",
    "Longitude": "-79.9536384"
  },
  {
    "Name": "Webster Hall Apartments",
    "Studio Price": 0.82,
    "1BR Price": 0.5,
    "2BR Price": 0.59,
    "3BR Price": 1.17,
    "Location": "Oakland",
    "In-unit Laundry": "No",
    "Fitness": "Yes",
    "Open to undergrad": "Yes",
    "Parking": "Yes",
    "Distance in miles": 1,
    "Bus Duration": 1,
    "Rating (Google Maps)": 0.41,
    "Year Built": 0.06,
    "phone number": "412-621-4132",
    "address": "101 N Dithridge St Suite 130, Pittsburgh, PA 15213",
    "Price0": 1450,
    "Price1": 1800,
    "Price2": 2250,
    "Price3": "N/A",
    "Image": "https://images1.apartments.com/i2/eHLZy3ScYlyy7tayVs4eRESD4kQmJRVoU3oJCilmLwg/111/webster-hall-pittsburgh-pa-primary-photo.jpg",
    "Website": "https://www.websterhallapartments.com/",
    "Latitude": "40.4470621",
    "Longitude": "-79.9534939"
  },
  {
    "Name": "Amberson Gardens Apartments",
    "Studio Price": 0.91,
    "1BR Price": 0.94,
    "2BR Price": 0.94,
    "3BR Price": 1.17,
    "Location": "Shadyside",
    "In-unit Laundry": "No",
    "Fitness": "Yes",
    "Open to undergrad": "Yes",
    "Parking": "Yes",
    "Distance in miles": 0.88,
    "Bus Duration": 0.44,
    "Rating (Google Maps)": 0.24,
    "Year Built": 0.41,
    "phone number": "412-681-9870",
    "address": "1 Bayard Rd, Pittsburgh, PA 15213",
    "Price0": 1100,
    "Price1": 1300,
    "Price2": 1700,
    "Price3": "N/A",
    "Image": "https://lh5.googleusercontent.com/p/AF1QipPTUaWb0SW_qiRkrp8AUjZ5BchEyIAZzydFgkin=w408-h306-k-no",
    "Website": "https://www.apartments.com/amberson-gardens-pittsburgh-pa/w2vgfbj/",
    "Latitude": "40.4532841",
    "Longitude": "-79.9454667"
  },
  {
    "Name": "Essex House",
    "Studio Price": 1.09,
    "1BR Price": 0.75,
    "2BR Price": 0.76,
    "3BR Price": 1.17,
    "Location": "Shadyside",
    "In-unit Laundry": "No",
    "Fitness": "Yes",
    "Open to undergrad": "Yes",
    "Parking": "Yes",
    "Distance in miles": 0.47,
    "Bus Duration": 0.19,
    "Rating (Google Maps)": 0.47,
    "Year Built": 0.53,
    "phone number": "412-441-0820",
    "address": "5701 Centre Ave, Pittsburgh, PA 15206",
    "Price0": "N/A",
    "Price1": 1650,
    "Price2": 2050,
    "Price3": "N/A",
    "Image": "https://mcquartersrealty.com/wp-content/uploads/2019/09/esx_exterior-1371x1026.jpg",
    "Website": "https://mcquartersrealty.com/apartments/essex-house/",
    "Latitude": "40.457671",
    "Longitude": "-79.9360425"
  },
  {
    "Name": "Claybourne Apartment",
    "Studio Price": 1.09,
    "1BR Price": 0.88,
    "2BR Price": 0.88,
    "3BR Price": 1.17,
    "Location": "Shadyside",
    "In-unit Laundry": "No",
    "Fitness": "Yes",
    "Open to undergrad": "Yes",
    "Parking": "Yes",
    "Distance in miles": 0.53,
    "Bus Duration": 0.44,
    "Rating (Google Maps)": 0.29,
    "Year Built": 0.35,
    "phone number": "412-441-0820",
    "address": "5435 Claybourne St, Pittsburgh, PA 15232",
    "Price0": "N/A",
    "Price1": 1550,
    "Price2": 1800,
    "Price3": "N/A",
    "Image": "https://mcquartersrealty.com/wp-content/uploads/2019/09/clay_IMG_4605copy2-1371x1026.jpg",
    "Website": "https://mcquartersrealty.com/apartments/claybourne-apartments/",
    "Latitude": "40.455539",
    "Longitude": "-79.93912"
  },
  {
    "Name": "Coda on Center",
    "Studio Price": 0.55,
    "1BR Price": 0.38,
    "2BR Price": 0.29,
    "3BR Price": 1.17,
    "Location": "Shadyside",
    "In-unit Laundry": "Yes",
    "Fitness": "Yes",
    "Open to undergrad": "Yes",
    "Parking": "Yes",
    "Distance in miles": 0.35,
    "Bus Duration": 0.13,
    "Rating (Google Maps)": 0.18,
    "Year Built": 0.82,
    "phone number": "412-404-8653",
    "address": "5765 Centre Ave, Pittsburgh, PA 15206",
    "Price0": 1660,
    "Price1": 1900,
    "Price2": 2700,
    "Price3": "N/A",
    "Image": "https://images1.apartments.com/i2/es0pjNkBfvaiFrS_mv9Yp0tUayvX6VGAoRuUEGnGvDU/111/coda-on-centre-pittsburgh-pa-building-photo.jpg",
    "Website": "https://codaoncentre.com",
    "Latitude": "40.4579353",
    "Longitude": "-79.9323272"
  },
  {
    "Name": "Industry Pittsburgh",
    "Studio Price": 0.09,
    "1BR Price": 0.06,
    "2BR Price": 0.06,
    "3BR Price": 1.17,
    "Location": "Shadyside",
    "In-unit Laundry": "Yes",
    "Fitness": "Yes",
    "Open to undergrad": "Yes",
    "Parking": "Yes",
    "Distance in miles": 0.35,
    "Bus Duration": 0.19,
    "Rating (Google Maps)": 0.71,
    "Year Built": 1,
    "phone number": "412-851-6321",
    "address": "5819 Centre Ave, Pittsburgh, PA 15206",
    "Price0": 2170,
    "Price1": 2400,
    "Price2": 5200,
    "Price3": "N/A",
    "Image": "https://lh3.googleusercontent.com/p/AF1QipMNToqzPewv6nqtHSHwutqi2udPZgN9robBPqe9=s1360-w1360-h1020",
    "Website": "https://industry-pittsburgh.com",
    "Latitude": "40.4583596",
    "Longitude": "-79.9312796"
  },
  {
    "Name": "Walnut on Highland",
    "Studio Price": 0.45,
    "1BR Price": 0.31,
    "2BR Price": 0.41,
    "3BR Price": 1.17,
    "Location": "Shadyside",
    "In-unit Laundry": "No",
    "Fitness": "Yes",
    "Open to undergrad": "Yes",
    "Parking": "Yes",
    "Distance in miles": 0.12,
    "Bus Duration": 0.56,
    "Rating (Google Maps)": 0.82,
    "Year Built": 0.59,
    "phone number": "844-995-1004",
    "address": "121 S Highland Ave, Pittsburgh, PA 15206",
    "Price0": 1753,
    "Price1": 1991,
    "Price2": 2500,
    "Price3": "N/A",
    "Image": "https://www.walnutcapital.com/files/albums/45/images/exterior.jpg",
    "Website": "https://www.walnutonhighland.com/",
    "Latitude": "40.4602129",
    "Longitude": "-79.924797"
  },
  {
    "Name": "Eastside Bond Apartments",
    "Studio Price": 0.36,
    "1BR Price": 0.13,
    "2BR Price": 0.12,
    "3BR Price": 1.17,
    "Location": "Shadyside",
    "In-unit Laundry": "Yes",
    "Fitness": "Yes",
    "Open to undergrad": "Yes",
    "Parking": "Yes",
    "Distance in miles": 0.12,
    "Bus Duration": 0.06,
    "Rating (Google Maps)": 0.47,
    "Year Built": 0.65,
    "phone number": "412-253-2775",
    "address": "6105 Spirit St, Pittsburgh, PA 15206",
    "Price0": 1800,
    "Price1": 2300,
    "Price2": 3500,
    "Price3": "N/A",
    "Image": "https://lh3.googleusercontent.com/p/AF1QipNJ0dfMJNY_Sv3fnC6e2M7WRH0wdRbuwOCg-0rL=s1360-w1360-h1020",
    "Website": "https://www.eastsidebond.com/",
    "Latitude": "40.4599747",
    "Longitude": "-79.9257807"
  },
  {
    "Name": "Bakery Living",
    "Studio Price": 0.64,
    "1BR Price": 0.5,
    "2BR Price": 0.24,
    "3BR Price": 1.17,
    "Location": "Shadyside",
    "In-unit Laundry": "Yes",
    "Fitness": "Yes",
    "Open to undergrad": "Yes",
    "Parking": "Yes",
    "Distance in miles": 0.06,
    "Bus Duration": 0.31,
    "Rating (Google Maps)": 0.71,
    "Year Built": 0.71,
    "phone number": "833-334-8042",
    "address": "6480 Living Pl, Pittsburgh, PA 15206",
    "Price0": 1650,
    "Price1": 1800,
    "Price2": 3000,
    "Price3": "N/A",
    "Image": "https://resource.rentcafe.com/image/upload/q_auto,f_auto/s3/2/6837/album_bakeryliving-2.jpg",
    "Website": "https://www.bakeryliving.com/",
    "Latitude": "40.4555746",
    "Longitude": "-79.9194839"
  },
  {
    "Name": "Kenmawr Apartments",
    "Studio Price": 1.09,
    "1BR Price": 0.81,
    "2BR Price": 0.82,
    "3BR Price": 1,
    "Location": "Shadyside",
    "In-unit Laundry": "No",
    "Fitness": "Yes",
    "Open to undergrad": "Yes",
    "Parking": "Yes",
    "Distance in miles": 0.24,
    "Bus Duration": 0.38,
    "Rating (Google Maps)": 0.06,
    "Year Built": 0.12,
    "phone number": "412-361-2774",
    "address": "Kenmawr Apartments, 401 Shady Ave, Pittsburgh, PA 15206",
    "Price0": "N/A",
    "Price1": 1600,
    "Price2": 1900,
    "Price3": 2600,
    "Image": "https://images1.apartments.com/i2/udSAQT2dm_J3J5xa2V9R6l4-7IqC2_92Cf4xer2DMd0/111/kenmawr-apartments-pittsburgh-pa-building-photo.jpg",
    "Website": "https://www.pmcpropertygroup.com/properties/kenmawr-apartments",
    "Latitude": "40.4552298",
    "Longitude": "-79.9237069"
  },
  {
    "Name": "Maxon Towers Apartments",
    "Studio Price": 1.09,
    "1BR Price": 0.69,
    "2BR Price": 0.71,
    "3BR Price": 1.17,
    "Location": "Squirrel Hill",
    "In-unit Laundry": "No",
    "Fitness": "Yes",
    "Open to undergrad": "Yes",
    "Parking": "Yes",
    "Distance in miles": 0.29,
    "Bus Duration": 0.81,
    "Rating (Google Maps)": 0.59,
    "Year Built": 0.29,
    "phone number": "412-521-7900",
    "address": "6315 Forbes Ave l100, Pittsburgh, PA 15217",
    "Price0": "N/A",
    "Price1": 1700,
    "Price2": 2200,
    "Price3": 2900,
    "Image": "https://media.veryapt.com/ApartmentImage/pennsylvania/pittsburgh-15217/maxon-towers/gallery/2.jpg",
    "Website": "https://www.maxontowers.com/",
    "Latitude": "40.4381887",
    "Longitude": "-79.9210128"
  },
  {
    "Name": "Negley Court Apartments",
    "Studio Price": 1,
    "1BR Price": 1,
    "2BR Price": 1,
    "3BR Price": 1.17,
    "Location": "Squirrel Hill",
    "In-unit Laundry": "No",
    "Fitness": "No",
    "Open to undergrad": "Yes",
    "Parking": "Yes",
    "Distance in miles": 0.65,
    "Bus Duration": 1,
    "Rating (Google Maps)": 0.59,
    "Year Built": 0.18,
    "phone number": "412-288-7800",
    "address": "5620 Fifth Ave, Pittsburgh, PA 15232",
    "Price0": 885,
    "Price1": 1100,
    "Price2": 1600,
    "Price3": "N/A",
    "Image": "https://images.squarespace-cdn.com/content/v1/535eb679e4b0daaf97db3363/1441310101485-J0OSJLTT1U04WVWANARY/130430_Union_NegleyCourt_6.jpg",
    "Website": "https://www.apartments.com/negley-court-pittsburgh-pa/k28meyb/",
    "Latitude": "40.4494115",
    "Longitude": "-79.9323159"
  },
  {
    "Name": "Camelot Apartments",
    "Studio Price": 1.09,
    "1BR Price": 1.06,
    "2BR Price": 0.65,
    "3BR Price": 0.67,
    "Location": "Oakland",
    "In-unit Laundry": "No",
    "Fitness": "Yes",
    "Open to undergrad": "Yes",
    "Parking": "Yes",
    "Distance in miles": 0.76,
    "Bus Duration": 0.56,
    "Rating (Google Maps)": 1,
    "Year Built": 0.24,
    "phone number": "412-688-6309",
    "address": "262 N Dithridge St, Pittsburgh, PA 15213",
    "Price0": "N/A",
    "Price1": "N/A",
    "Price2": 2230,
    "Price3": 2800,
    "Image": "https://lh3.googleusercontent.com/p/AF1QipN8TvwYo45vAb-epmI1W6tEmRIHqPxd13lWsypc=s1360-w1360-h1020",
    "Website": "https://www.camelot-apartments.com/",
    "Latitude": "40.4509291",
    "Longitude": "-79.9550979"
  }
]