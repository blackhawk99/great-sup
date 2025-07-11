import React, { useState, useEffect } from "react";
import { ArrowLeft, ArrowRight, AlertCircle } from "lucide-react";
import { parseGoogleMapsUrl } from "./googleMapsUtils.js";

export { parseGoogleMapsUrl };

/* eslint react-refresh/only-export-components: off */

// Helper function to convert degrees to cardinal directions
export const getCardinalDirection = (degrees) => {
  const val = Math.floor((degrees / 22.5) + 0.5);
  const directions = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return directions[(val % 16)];
};


// Error Boundary Component
export const ErrorBoundary = ({ children }) => {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const errorHandler = (error) => {
      console.error("Caught error:", error);
      setError(error.message || "Unknown error");
      setHasError(true);
    };

    window.addEventListener('error', errorHandler);
    return () => {
      window.removeEventListener('error', errorHandler);
    };
  }, []);

  if (hasError) {
    return (
      <div className="p-8 bg-red-50 rounded-lg border border-red-200 text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-red-700 mb-4">Something went wrong</h2>
        <p className="text-red-600 mb-4">
          {error || "There was an error rendering this component"}
        </p>
        <button
          onClick={() => {
            setHasError(false);
            setError(null);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  return children;
};

// Date Picker Modal Component
export const DatePickerModal = ({ currentDate = new Date(), onSelect, onClose }) => {
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState(currentDate);
  const [month, setMonth] = useState(selectedDate.getMonth());
  const [year, setYear] = useState(selectedDate.getFullYear());
  
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  
  const handlePrevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  };
  
  const handleNextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  };
  
  const handleDateClick = (day) => {
    const newDate = new Date(year, month, day);
    setSelectedDate(newDate);
  };
  
  const handleSelect = () => {
    const formattedDate = selectedDate.toISOString().split('T')[0];
    onSelect(formattedDate);
  };

  const handleSetToday = () => {
    setSelectedDate(new Date());
    setMonth(today.getMonth());
    setYear(today.getFullYear());
  };

  const handleSetTomorrow = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setSelectedDate(tomorrow);
    setMonth(tomorrow.getMonth());
    setYear(tomorrow.getFullYear());
  };
  
  const days = [];
  
  // Add empty cells for days before the first day of the month
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(<div key={`empty-${i}`} className="h-10"></div>);
  }
  
  // Add the days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const isSelected = 
      selectedDate.getDate() === day &&
      selectedDate.getMonth() === month &&
      selectedDate.getFullYear() === year;
    
    const isToday =
      today.getDate() === day &&
      today.getMonth() === month &&
      today.getFullYear() === year;
    
    days.push(
      <div
        key={day}
        className={`h-12 w-12 flex items-center justify-center rounded-full cursor-pointer text-lg
          ${isSelected ? 'bg-blue-500 text-white' : ''}
          ${isToday && !isSelected ? 'border border-blue-500 text-blue-600' : ''}
          ${!isSelected && !isToday ? 'hover:bg-gray-100' : ''}
        `}
        onClick={() => handleDateClick(day)}
      >
        {day}
      </div>
    );
  }
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-5 w-full max-w-xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Select Date</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>
        
        <div className="flex space-x-4 mb-4">
          <button 
            onClick={handleSetToday}
            className="flex-1 bg-blue-500 text-white py-3 px-6 rounded-xl text-lg font-medium hover:bg-blue-600 transition"
          >
            Today
          </button>
          <button 
            onClick={handleSetTomorrow}
            className="flex-1 bg-blue-500 text-white py-3 px-6 rounded-xl text-lg font-medium hover:bg-blue-600 transition"
          >
            Tomorrow
          </button>
        </div>
        
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <button onClick={handlePrevMonth} className="p-1 rounded-full hover:bg-gray-100">
              <ArrowLeft className="h-6 w-6" />
            </button>
            <span className="text-lg font-medium">{monthNames[month]} {year}</span>
            <button onClick={handleNextMonth} className="p-1 rounded-full hover:bg-gray-100">
              <ArrowRight className="h-6 w-6" />
            </button>
          </div>
          
          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            <div className="text-gray-500">Su</div>
            <div className="text-gray-500">Mo</div>
            <div className="text-gray-500">Tu</div>
            <div className="text-gray-500">We</div>
            <div className="text-gray-500">Th</div>
            <div className="text-gray-500">Fr</div>
            <div className="text-gray-500">Sa</div>
          </div>
          
          <div className="grid grid-cols-7 gap-1">
            {days}
          </div>
        </div>
        
        <div className="flex justify-end">
          <button
            onClick={handleSelect}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700"
          >
            Select
          </button>
        </div>
      </div>
    </div>
  );
};

// Delete Confirmation Modal Component
export const DeleteConfirmationModal = ({ beach, onConfirm, onCancel }) => {
  if (!beach || !beach.id || !beach.name) {
    setTimeout(onCancel, 0);
    return null;
  }
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-medium mb-4">Confirm Deletion</h3>
        <p className="text-gray-700 mb-4">
          Are you sure you want to remove <span className="font-semibold">{beach.name}</span>?
        </p>
        <div className="flex justify-end space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(beach.id)}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};
