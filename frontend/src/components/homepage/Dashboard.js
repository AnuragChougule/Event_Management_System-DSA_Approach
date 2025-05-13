import React, { useState, useEffect } from "react";
import HotelCard from './HotelCard.js';
import { dijkstra } from '../../utils/dijkstra.js';

function Dashboard() {
  const [hotels, setHotels] = useState([]);
  const [filteredHotels, setFilteredHotels] = useState([]);
  const [graph, setGraph] = useState({});
  const [location, setLocation] = useState("");
  const [eventFilter, setEventFilter] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minCapacity, setMinCapacity] = useState("");
  const [maxCapacity, setMaxCapacity] = useState("");

  const locationsList = [
    "Tilakwadi", "Hanuman Nagar", "Bhagya Nagar", "Ramteerth Nagar",
    "Sadashiv Nagar", "Mahantesh Nagar", "Khasbag", "Nehru Nagar", "Angol",
    "Vaibhav Nagar", "Shree Nagar", "Ganeshpur", "Rani Chennamma Nagar",
    "Sahyadri Nagar", "Azam Nagar", "Auto Nagar", "Shahu Nagar", "Club Road",
    "Gandhi Nagar", "Kangrali", "Sambra", "Kanabargi", "Vinayak Nagar",
    "Manikbag", "Bk kangrali", "Majagaon", "Macche", "main City", "Udyambag"
  ];

  useEffect(() => {
    fetch("/hotels.json").then(res => res.json()).then(data => {
      setHotels(data);
      setFilteredHotels(data);
    });

    fetch("/graph.json").then(res => res.json()).then(data => {
      setGraph(data);
    });
  }, []);

  const handleSearch = () => {
    if (!location || !graph[location]) {
      alert("Please select a valid location.");
      return;
    }

    const distances = dijkstra(graph, location);

    let updated = [...hotels];

    // Apply filters conditionally
    if (eventFilter) {
      updated = updated.filter(hotel => hotel.supportedEvents.includes(eventFilter));
    }

    if (minPrice !== "") {
      updated = updated.filter(hotel => hotel.price >= parseInt(minPrice));
    }

    if (maxPrice !== "") {
      updated = updated.filter(hotel => hotel.price <= parseInt(maxPrice));
    }

    if (minCapacity !== "") {
      updated = updated.filter(hotel => hotel.capacity >= parseInt(minCapacity));
    }

    if (maxCapacity !== "") {
      updated = updated.filter(hotel => hotel.capacity <= parseInt(maxCapacity));
    }

    // Sort by proximity
    updated.sort((a, b) => {
      const d1 = distances[a.area] ?? Infinity;
      const d2 = distances[b.area] ?? Infinity;

      if (d1 === 0 && d2 !== 0) return -1;
      if (d1 !== 0 && d2 === 0) return 1;

      return d1 - d2;
    });

    setFilteredHotels(updated);
  };

  return (
    <div
      style={{
        backgroundImage: `url('/events_back.jpg')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        minHeight: "100vh",
        padding: "20px",
        fontFamily: "'Poppins', sans-serif",
        color: "#333",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{
        display: "flex",
        flex: 1,
        gap: "20px",
        flexDirection: window.innerWidth <= 768 ? "column" : "row",
      }}>
        {/* Sidebar Filters */}
        <div style={{
          backgroundColor: "rgba(255,255,255,0.9)",
          borderRadius: "20px",
          padding: "20px",
          width: window.innerWidth <= 768 ? "100%" : "300px",
          height: "fit-content",
          boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
          transition: "all 0.3s ease",
          backdropFilter: "blur(4px)",
        }}>
          <h2 style={{ textAlign: "center", color: "#B76E79", marginBottom: "20px" }}>🔎 Filters</h2>

          {/* Location Filter */}
          <div style={{ marginBottom: "20px" }}>
            <label style={{ fontWeight: "bold" }}>Your Location</label>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              style={inputStyle}
            >
              <option value="">-- Select Location --</option>
              {locationsList.map(loc => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </div>

          {/* Event Filter */}
          <div style={{ marginBottom: "20px" }}>
            <label style={{ fontWeight: "bold" }}>Event Type</label>
            <select
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
              style={inputStyle}
            >
              <option value="">-- Select Event --</option>
              <option value="Marriage">Marriage</option>
              <option value="Birthday">Birthday</option>
              <option value="Naming Ceremony">Naming Ceremony</option>
              <option value="Official Meeting">Official Meeting</option>
            </select>
          </div>

          {/* Price Filter */}
          <div style={{ marginBottom: "20px" }}>
            <label style={{ fontWeight: "bold" }}>Price (₹)</label>
            <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
              <input type="number" placeholder="Min" value={minPrice} onChange={e => setMinPrice(e.target.value)} style={{ ...inputStyle, width: "50%" }} />
              <input type="number" placeholder="Max" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} style={{ ...inputStyle, width: "50%" }} />
            </div>
          </div>

          {/* Capacity Filter */}
          <div style={{ marginBottom: "20px" }}>
            <label style={{ fontWeight: "bold" }}>Capacity</label>
            <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
              <input type="number" placeholder="Min" value={minCapacity} onChange={e => setMinCapacity(e.target.value)} style={{ ...inputStyle, width: "50%" }} />
              <input type="number" placeholder="Max" value={maxCapacity} onChange={e => setMaxCapacity(e.target.value)} style={{ ...inputStyle, width: "50%" }} />
            </div>
          </div>

          {/* Search Button */}
          <button
            onClick={handleSearch}
            style={searchButtonStyle}
            onMouseOver={e => e.target.style.backgroundColor = "#a05562"}
            onMouseOut={e => e.target.style.backgroundColor = "#B76E79"}
          >
            🔍 Search
          </button>
        </div>

        {/* Hotel List */}
        <div style={{
          flex: 1,
          backgroundColor: "rgba(255,255,255,0.85)",
          borderRadius: "20px",
          padding: "30px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
          overflow: "hidden",
        }}>
          <h1 style={{
            fontSize: "2.5rem",
            textAlign: "center",
            marginBottom: "30px",
            color: "#B76E79",
            animation: "fadeIn 1s ease forwards",
          }}>
            📍 Event Venue Finder
          </h1>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "20px",
            animation: "fadeIn 2s ease forwards",
          }}>
            {filteredHotels.map((hotel) => (
              <HotelCard
                key={hotel.id}
                hotel={hotel}
                distance={graph[location] ? dijkstra(graph, location)[hotel.area] : undefined}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Animations */}
      <style>
        {`
          @keyframes fadeIn {
            0% { opacity: 0; transform: translateY(20px); }
            100% { opacity: 1; transform: translateY(0); }
          }
        `}
      </style>
    </div>
  );
}

// Reusable styles
const inputStyle = {
  width: "100%",
  padding: "10px",
  borderRadius: "10px",
  border: "1px solid #ccc",
  fontSize: "1rem",
  transition: "0.3s",
};

const searchButtonStyle = {
  marginTop: "10px",
  width: "100%",
  padding: "12px",
  borderRadius: "12px",
  backgroundColor: "#B76E79",
  color: "white",
  border: "none",
  fontSize: "1rem",
  fontWeight: "bold",
  cursor: "pointer",
  transition: "0.3s",
};

export default Dashboard;
