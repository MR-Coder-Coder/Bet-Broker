import React, { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase'; // Import Firebase
import { useNavigate } from 'react-router-dom'; // Import the useNavigate hook

const SubmitRequest = () => {
  const navigate = useNavigate(); // Initialize the navigate hook
  
  // Initialize formData with default values, datetime and systemdate will be set on submit
  const [formData, setFormData] = useState({
    bet: "USA @ 3.5",
    betlimit: "UnLimited",
    datetime: "", // Will be updated on submit
    event: "Mexico v USA",
    ip_address: "0.0.0.0",
    league: "International Friendly",
    market: "Soccer 1 X 2 - 1st Half",
    notes: "No Additional Notes",
    origin: "manager-dashboard",
    requestby: "Client Name",
    requestprice: 3.5,
    seekprice: 3.51,
    status: "Open",
    systemdate: "" // Will be updated on submit
  });

  const [errors, setErrors] = useState({});

// Function to get the current formatted date and time in DD/MM/YYYY, HH:MM:SS AM/PM format (UK)
const getCurrentDateTime = () => {
    const currentDate = new Date();
  
    // Define options for formatting the date
    const options = {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    };
  
    // Format the date and time in UK English format
    const formattedDateTime = new Intl.DateTimeFormat('en-US', options).format(currentDate);
  
    return formattedDateTime;
  };
  
  

  const validate = () => {
    const newErrors = {};

    if (!formData.bet) newErrors.bet = "Bet amount is required";
    if (!formData.betlimit) newErrors.betlimit = "Bet limit is required";
    if ((formData.requestprice && isNaN(formData.requestprice)) || (!formData.requestprice)) {
        newErrors.requestprice = "Request price must be a number";
      }
    if ((formData.seekprice && isNaN(formData.seekprice)) || (!formData.seekprice)) {
        newErrors.seekprice = "Seek price must be a number";
      }
      

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0; 
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return; 

    // Set the current datetime and systemdate
    const currentDateTime = getCurrentDateTime();
    const updatedFormData = {
      ...formData,
      datetime: currentDateTime, // Set to current date and time
      systemdate: currentDateTime // Set to current date and time
    };

    try {
      const docRef = await addDoc(collection(db, "transactions"), updatedFormData);
      console.log("Document written with ID: ", docRef.id);
      
      // After successful submission, navigate back to the previous page
      navigate(-1); // Go back to the previous page
    } catch (error) {
      console.error("Error writing document: ", error);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-gray-800 text-white p-6 rounded-md shadow-md max-w-md mx-auto">
      <h2 className="text-xl font-bold mb-4 text-center">Submit a Request</h2>

      <div className="mb-4">
        <label htmlFor="market" className="block mb-2 text-sm font-medium text-gray-300">Market</label>
        <input
          type="text"
          name="market"
          value={formData.market}
          onChange={handleChange}
          className="w-full p-2 rounded-md bg-gray-700 border border-gray-600 text-white"
        />
        {errors.bet && <span className="text-red-500 text-sm mt-1">{errors.bet}</span>}
      </div>

      <div className="mb-4">
        <label htmlFor="league" className="block mb-2 text-sm font-medium text-gray-300">League</label>
        <input
          type="text"
          name="league"
          value={formData.league}
          onChange={handleChange}
          className="w-full p-2 rounded-md bg-gray-700 border border-gray-600 text-white"
        />
        {errors.league && <span className="text-red-500 text-sm mt-1">{errors.league}</span>}
      </div>

      <div className="mb-4">
        <label htmlFor="event" className="block mb-2 text-sm font-medium text-gray-300">Event</label>
        <input
          type="text"
          name="event"
          value={formData.event}
          onChange={handleChange}
          className="w-full p-2 rounded-md bg-gray-700 border border-gray-600 text-white"
        />
        {errors.event && <span className="text-red-500 text-sm mt-1">{errors.event}</span>}
      </div>

      <div className="mb-4">
        <label htmlFor="bet" className="block mb-2 text-sm font-medium text-gray-300">Bet Details</label>
        <input
          type="text"
          name="bet"
          value={formData.bet}
          onChange={handleChange}
          className="w-full p-2 rounded-md bg-gray-700 border border-gray-600 text-white"
        />
        {errors.bet && <span className="text-red-500 text-sm mt-1">{errors.bet}</span>}
      </div>
      
      <div className="mb-4">
        <label htmlFor="requestby" className="block mb-2 text-sm font-medium text-gray-300">Client Name</label>
        <input
          type="text"
          name="requestby"
          value={formData.requestby}
          onChange={handleChange}
          className="w-full p-2 rounded-md bg-gray-700 border border-gray-600 text-white"
        />
        {errors.requestby && <span className="text-red-500 text-sm mt-1">{errors.requestby}</span>}
      </div>      

      <div className="mb-4">
        <label htmlFor="betlimit" className="block mb-2 text-sm font-medium text-gray-300">Bet Limit</label>
        <input
          type="text"
          name="betlimit"
          value={formData.betlimit}
          onChange={handleChange}
          className="w-full p-2 rounded-md bg-gray-700 border border-gray-600 text-white"
        />
        {errors.betlimit && <span className="text-red-500 text-sm mt-1">{errors.betlimit}</span>}
      </div>

      <div className="mb-4">
        <label htmlFor="requestprice" className="block mb-2 text-sm font-medium text-gray-300">Request Price</label>
        <input
          type="text"
          name="requestprice"
          value={formData.requestprice}
          onChange={handleChange}
          className="w-full p-2 rounded-md bg-gray-700 border border-gray-600 text-white"
        />
        {errors.requestprice && <span className="text-red-500 text-sm mt-1">{errors.requestprice}</span>}
      </div>

      <div className="mb-4">
        <label htmlFor="seekprice" className="block mb-2 text-sm font-medium text-gray-300">Seek Price</label>
        <input
          type="text"
          name="seekprice"
          value={formData.seekprice}
          onChange={handleChange}
          className="w-full p-2 rounded-md bg-gray-700 border border-gray-600 text-white"
        />
        {errors.seekprice && <span className="text-red-500 text-sm mt-1">{errors.seekprice}</span>}
      </div>

      <div className="mb-4">
        <label htmlFor="notes" className="block mb-2 text-sm font-medium text-gray-300">Notes</label>
        <input
          type="text"
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          className="w-full p-2 rounded-md bg-gray-700 border border-gray-600 text-white"
        />
        {errors.notes && <span className="text-red-500 text-sm mt-1">{errors.notes}</span>}
      </div>

      <button type="submit" className="w-full p-3 mt-4 bg-blue-600 hover:bg-blue-500 rounded-md text-white font-bold">
        Submit Request
      </button>
    </form>
  );
};

export default SubmitRequest;
