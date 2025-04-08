// Fix 1: Update the renderScoreBreakdown function
// In src/App.jsx, find the renderScoreBreakdown function and update the table row for Wind Speed:

const renderScoreBreakdown = (breakdown) => {
  if (!breakdown) return null;
  
  return (
    <div className="bg-white p-5 rounded-lg mt-4 shadow-sm border">
      <h4 className="font-medium mb-4 flex items-center text-gray-800">
        <Info className="h-5 w-5 mr-2 text-blue-600" />
        Score Breakdown
        <span className="ml-2 text-sm text-blue-500 font-normal">
          (Based on {timeRange.startTime}-{timeRange.endTime} window)
        </span>
      </h4>
      
      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Factor</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            <tr>
              <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-700">Wind Speed</td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 text-right">
                {breakdown.windSpeed.raw.toFixed(1)} km/h 
                <span className="text-xs text-gray-400 ml-1">
                  (Protected: {Math.max(0, breakdown.windSpeed.protected).toFixed(1)})
                </span>
              </td>
              <td className={`px-4 py-2 whitespace-nowrap text-sm font-medium text-right ${
                breakdown.windSpeed.score > 30 ? 'text-green-600' : 
                breakdown.windSpeed.score > 20 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {breakdown.windSpeed.score}/{breakdown.windSpeed.maxPossible}
              </td>
            </tr>
            <tr>
              <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-700">Wave Height</td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 text-right">
                {breakdown.waveHeight.raw.toFixed(2)} m
                <span className="text-xs text-gray-400 ml-1">
                  (Protected: {Math.max(0, breakdown.waveHeight.protected).toFixed(2)})
                </span>
              </td>
              <td className={`px-4 py-2 whitespace-nowrap text-sm font-medium text-right ${
                breakdown.waveHeight.score > 15 ? 'text-green-600' : 
                breakdown.waveHeight.score > 10 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {breakdown.waveHeight.score}/{breakdown.waveHeight.maxPossible}
              </td>
            </tr>
            <tr>
              <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-700">Swell Height</td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 text-right">
                {breakdown.swellHeight.raw.toFixed(2)} m
              </td>
              <td className={`px-4 py-2 whitespace-nowrap text-sm font-medium text-right ${
                breakdown.swellHeight.score > 7 ? 'text-green-600' : 
                breakdown.swellHeight.score > 5 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {breakdown.swellHeight.score}/{breakdown.swellHeight.maxPossible}
              </td>
            </tr>
            {/* Rest of the rows remain the same */}
            
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Fix 2: Update the main score display to show the time period
// Find the "Score card - LEFT SIDE" section and update the Score display:

// In the Weather data display section:
{weatherData && score !== null && !loading && (
  <div className="p-6">
    {/* Main Score Overview */}
    <div className="flex flex-col md:flex-row gap-6 mb-6">
      {/* Score card - LEFT SIDE */}
      <div className="md:w-1/3 bg-white rounded-lg shadow-md p-6 text-center flex flex-col justify-center">
        <div
          className={`text-6xl mb-3 ${
            score >= 85
              ? "text-green-500"
              : score >= 70
              ? "text-yellow-500"
              : score >= 50
              ? "text-orange-500"
              : "text-red-500"
          }`}
        >
          {getCondition(score).emoji}
        </div>
        <h3 className="text-3xl font-bold mb-2">
          {getCondition(score).label}
        </h3>
        <p className="text-gray-600 text-lg mb-4">{getCondition(score).message}</p>
        <div className="mt-2 bg-gray-100 rounded-full h-5 overflow-hidden">
          <div
            className={`h-full ${
              score >= 85
                ? "bg-green-500"
                : score >= 70
                ? "bg-yellow-500"
                : score >= 50
                ? "bg-orange-500"
                : "bg-red-500"
            }`}
            style={{ width: `${score}%` }}
          ></div>
        </div>
        <p className="mt-2 text-lg font-medium text-gray-700">
          Score: {score}/100
        </p>
        <p className="text-sm text-blue-500 mt-1">
          For {timeRange.startTime}-{timeRange.endTime} window
        </p>
        <div className="mt-1 text-xs text-gray-500 flex items-center justify-center">
          {weatherData.isRealData ? (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 mr-1 text-green-500">
                <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
              </svg>
              Using real Open-Meteo data
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 mr-1 text-yellow-500">
                <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
              </svg>
              Using simulated data with dynamic analysis
            </>
          )}
        </div>
      </div>
      
      {/* Rest of the content remains the same */}
    </div>
    
    {/* Rest of the components remain the same */}
  </div>
)}
