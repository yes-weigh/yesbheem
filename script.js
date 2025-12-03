// District data with names and descriptions
const districtData = {
    kasaragod: {
        name: "Kasaragod",
        description: "The northernmost district of Kerala, known for its beautiful beaches, historic forts like Bekal Fort, and rich cultural heritage. Famous for Theyyam performances and pristine coastline."
    },
    kannur: {
        name: "Kannur",
        description: "Known as the 'Land of Looms and Lores', Kannur is famous for its handloom industry, Theyyam rituals, and beautiful beaches. Home to the historic St. Angelo Fort and vibrant cultural traditions."
    },
    wayanad: {
        name: "Wayanad",
        description: "A picturesque hill station known for its lush green forests, wildlife sanctuaries, and spice plantations. Popular for trekking, wildlife tourism, and scenic beauty with waterfalls and caves."
    },
    kozhikode: {
        name: "Kozhikode",
        description: "Also known as Calicut, this historic port city was once a major trading center for spices. Famous for its Malabar cuisine, especially biryani, and beautiful beaches like Kappad where Vasco da Gama landed."
    },
    malappuram: {
        name: "Malappuram",
        description: "A culturally rich district known for its Islamic heritage, traditional arts, and educational institutions. Famous for Mappila songs, Malappuram cuisine, and the historic Kottakkunnu park."
    },
    palakkad: {
        name: "Palakkad",
        description: "Known as the 'Gateway of Kerala', Palakkad is famous for its paddy fields, the historic Palakkad Fort, and the Malampuzha Dam. The district is renowned for its classical music heritage and temples."
    },
    thrissur: {
        name: "Thrissur",
        description: "The cultural capital of Kerala, famous for the spectacular Thrissur Pooram festival. Home to numerous temples, churches, and the Kerala Kalamandalam, a premier institution for classical arts."
    },
    ernakulam: {
        name: "Ernakulam",
        description: "The commercial capital of Kerala, home to Kochi city. Known for its cosmopolitan culture, historic Fort Kochi, Chinese fishing nets, spice markets, and as a major port and industrial hub."
    },
    idukki: {
        name: "Idukki",
        description: "A mountainous district known for its stunning landscapes, tea and spice plantations, and the Idukki Dam. Popular tourist destinations include Munnar, Thekkady, and numerous waterfalls and viewpoints."
    },
    kottayam: {
        name: "Kottayam",
        description: "Known as the 'Land of Letters, Latex and Lakes', Kottayam is famous for its literacy rate, rubber plantations, and backwaters. Home to ancient churches and the scenic Vembanad Lake."
    },
    alappuzha: {
        name: "Alappuzha",
        description: "Known as the 'Venice of the East', Alappuzha is famous for its backwaters, houseboat cruises, and beaches. The district is renowned for coir industry, Nehru Trophy Boat Race, and scenic canals."
    },
    pathanamthitta: {
        name: "Pathanamthitta",
        description: "A pilgrim center known for the famous Sabarimala temple. The district is blessed with natural beauty, including forests, rivers, and the Gavi eco-tourism destination. Rich in religious and cultural heritage."
    },
    kollam: {
        name: "Kollam",
        description: "One of the oldest ports in the Malabar Coast, Kollam is known for its cashew industry, Ashtamudi Lake, and beautiful beaches. Famous for the Kollam-Alappuzha backwater cruise and historic monuments."
    },
    thiruvananthapuram: {
        name: "Thiruvananthapuram",
        description: "The capital city of Kerala, known for the iconic Padmanabhaswamy Temple, beautiful beaches like Kovalam, and as a center for IT and space research. Rich in art, culture, and colonial architecture."
    }
};

// Get DOM elements
const districts = document.querySelectorAll('.district');
const infoPanel = document.getElementById('info-panel');
const districtName = document.getElementById('district-name');
const districtDescription = document.getElementById('district-description');

// Add event listeners to each district
districts.forEach(district => {
    district.addEventListener('mouseenter', function() {
        const districtId = this.id;
        const data = districtData[districtId];
        
        if (data) {
            // Update info panel content
            districtName.textContent = data.name;
            districtDescription.textContent = data.description;
            
            // Add active class to info panel
            infoPanel.classList.add('active');
            
            // Add active class to district
            this.classList.add('active');
        }
    });
    
    district.addEventListener('mouseleave', function() {
        // Remove active class from district
        this.classList.remove('active');
    });
});

// Optional: Reset info panel when mouse leaves the entire map
const mapContainer = document.getElementById('kerala-map');
mapContainer.addEventListener('mouseleave', function() {
    districtName.textContent = 'Kerala';
    districtDescription.textContent = 'Hover over a district to see its information';
    infoPanel.classList.remove('active');
});
