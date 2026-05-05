import React, { useState, useEffect, useMemo } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { getToken, getUser } from "../../utils/auth";

const Dashboard = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [attendanceData, setAttendanceData] = useState(null);
  
  // Date range state
  const [fromDate, setFromDate] = useState('2026-05-10');
  const [toDate, setToDate] = useState('2026-05-30');
  
  // Processed data for cards
  const [cards, setCards] = useState([
    { id: 1, title: "Working Days", working: 0, holiday: 0, type: "working" },
    { id: 2, title: "Holidays", working: 0, holiday: 0, type: "holiday" },
    { id: 3, title: "Summary", working: 0, holiday: 0, type: "summary" },
  ]);

  const BASE = import.meta.env.VITE_API_URL;
  const token = getToken();
  const user = getUser();

  const headers = useMemo(
    () => ({
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "ngrok-skip-browser-warning": "true",
      "Content-Type": "application/json",
    }),
    [token],
  );

  // Fetch attendance data from API
  const fetchAttendanceData = async () => {
    if (!user?.id) {
      setError("User not authenticated");
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const url = `${BASE}/api/attendance/attendance-logs-each-day?user_id=${user.id}&from_date=${fromDate}&to_date=${toDate}&include_events=true`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: headers,
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setAttendanceData(result.data);
        processAttendanceData(result.data);
      } else {
        throw new Error(result.message || "Failed to fetch data");
      }
    } catch (err) {
      console.error("Error fetching attendance:", err);
      setError(err.message);
      // Set fallback demo data
      setFallbackData();
    } finally {
      setLoading(false);
    }
  };

  // Process API response to extract working vs holiday data
  const processAttendanceData = (data) => {
    if (!data) return;

    const { total_days, data: dailyLogs, global_summary } = data;
    
    // Count working days (days with attendance records)
    let workingDaysCount = 0;
    let holidayCount = 0;
    let totalWorkedHours = global_summary?.total_worked_hours || 0;
    let totalOvertime = global_summary?.total_overtime_hours || 0;
    let totalBreakHours = global_summary?.total_break_hours || 0;

    if (dailyLogs && dailyLogs.length > 0) {
      // Count days where user had activity (working days)
      workingDaysCount = dailyLogs.filter(log => 
        log.total_worked_hours > 0 || log.attendance_status === 'present'
      ).length;
      
      // Holiday count = total days in range - working days
      holidayCount = Math.max(0, total_days - workingDaysCount);
      
      // Calculate total worked hours from logs if not in summary
      if (totalWorkedHours === 0 && dailyLogs.length > 0) {
        totalWorkedHours = dailyLogs.reduce((sum, log) => sum + (log.total_worked_hours || 0), 0);
      }
    } else {
      // If no logs, assume all days are holidays/weekends
      holidayCount = total_days;
      workingDaysCount = 0;
    }

    // Update cards with processed data
    setCards([
      { 
        id: 1, 
        title: "Working Days", 
        working: workingDaysCount, 
        holiday: total_days - workingDaysCount,
        type: "working",
        workedHours: totalWorkedHours,
        overtime: totalOvertime
      },
      { 
        id: 2, 
        title: "Days Off", 
        working: holidayCount, 
        holiday: total_days - holidayCount,
        type: "holiday",
        breakHours: totalBreakHours
      },
      { 
        id: 3, 
        title: "Time Summary", 
        working: Math.floor(totalWorkedHours), 
        holiday: Math.floor(totalWorkedHours + totalOvertime),
        type: "summary",
        workedHours: totalWorkedHours,
        overtime: totalOvertime,
        breakHours: totalBreakHours,
        totalDays: total_days
      },
    ]);
  };

  // Set fallback demo data when API fails
  const setFallbackData = () => {
    setCards([
      { id: 1, title: "Working Days", working: 14, holiday: 7, type: "working", workedHours: 112, overtime: 8 },
      { id: 2, title: "Days Off", working: 7, holiday: 14, type: "holiday", breakHours: 0 },
      { id: 3, title: "Time Summary", working: 112, holiday: 120, type: "summary", workedHours: 112, overtime: 8, breakHours: 0, totalDays: 21 },
    ]);
  };

  // Handle date change
  const handleDateChange = () => {
    if (fromDate && toDate) {
      fetchAttendanceData();
    }
  };

  // Initial fetch on component mount and when user is available
  useEffect(() => {
    if (user?.id) {
      fetchAttendanceData();
    } else {
      setFallbackData();
    }
  }, [user?.id]);

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Card renderer based on type
  const renderCardContent = (card) => {
    switch (card.type) {
      case 'working':
        return (
          <>
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-xl border-l-4 border-green-500">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-gray-500 text-sm font-medium">WORKING DAYS</p>
                  <p className="text-3xl font-bold text-green-700">{card.working} days</p>
                  {card.workedHours > 0 && (
                    <p className="text-xs text-gray-500 mt-1">{card.workedHours} hours worked</p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-semibold text-green-600 bg-green-200 px-2 py-1 rounded-full">
                  {((card.working / (card.working + card.holiday)) * 100).toFixed(0)}% Active
                </span>
              </div>
            </div>
            {/* <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">Days Off</span>
              <span className="text-lg font-semibold text-orange-600">{card.holiday} days</span>
            </div> */}
            {card.overtime > 0 && (
              <div className="text-center text-xs text-blue-600 bg-blue-50 py-1 rounded">
                +{card.overtime} overtime hours
              </div>
            )}
          </>
        );
      
      case 'holiday':
        return (
          <>
            <div className="flex items-center justify-between p-4 bg-orange-50 rounded-xl border-l-4 border-orange-400">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-gray-500 text-sm font-medium">NON-WORKING DAYS</p>
                  <p className="text-3xl font-bold text-orange-700">{card.working} days</p>
                  <p className="text-xs text-gray-500 mt-1">Weekends & Holidays</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-semibold text-orange-600 bg-orange-200 px-2 py-1 rounded-full">
                  {((card.working / (card.working + card.holiday)) * 100).toFixed(0)}% Time off
                </span>
              </div>
            </div>
            {/* <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">Working Days</span>
              <span className="text-lg font-semibold text-green-600">{card.holiday} days</span>
            </div> */}
          </>
        );
      
      case 'summary':
        const totalPeriodDays = card.totalDays || (card.working + card.holiday);
        return (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500">Worked Hours</p>
                <p className="text-xl font-bold text-blue-700">{card.workedHours?.toFixed(1) || 0}h</p>
              </div>
              <div className="bg-purple-50 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500">Overtime</p>
                <p className="text-xl font-bold text-purple-700">{card.overtime?.toFixed(1) || 0}h</p>
              </div>
              <div className="bg-orange-50 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500">Break Hours</p>
                <p className="text-xl font-bold text-orange-700">{card.breakHours?.toFixed(1) || 0}h</p>
              </div>
              <div className="bg-green-50 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500">Period Days</p>
                <p className="text-xl font-bold text-green-700">{totalPeriodDays}</p>
              </div>
            </div>
            {/* <div className="mt-2 pt-2 border-t">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Work ratio</span>
                <span>{((card.working / totalPeriodDays) * 100).toFixed(0)}% work / {((card.holiday / totalPeriodDays) * 100).toFixed(0)}% off</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-green-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${(card.working / totalPeriodDays) * 100}%` }}
                />
              </div>
            </div> */}
          </>
        );
      
      default:
        return null;
    }
  };

  return (
    <MainLayout>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
        {/* Header with Date Range Picker */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-800 mb-2"> Attendance Dashboard</h1>
          
          {/* Date Range Selector */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <div className="flex items-center gap-2 bg-white rounded-lg shadow-sm px-4 py-2">
              <span className="text-sm text-gray-600">From:</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="border rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-2 bg-white rounded-lg shadow-sm px-4 py-2">
              <span className="text-sm text-gray-600">To:</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="border rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleDateChange}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Fetch Data
                </>
              )}
            </button>
          </div>
          
          {/* Date Range Display */}
          <div className="mt-3 text-sm text-gray-500">
            📅 {formatDate(fromDate)} — {formatDate(toDate)}
          </div>
          
          {/* Error Message */}
          {error && (
            <div className="mt-3 bg-red-50 text-red-700 px-4 py-2 rounded-lg text-sm inline-block">
              ⚠️ {error} — Showing demo data
            </div>
          )}
        </div>

        {/* Cards Grid - Three Cards as requested */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
          {cards.map((card) => (
            <div
              key={card.id}
              className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-shadow duration-300 overflow-hidden border border-gray-100"
            >
              {/* Card Header */}
              <div className={`px-6 py-4 ${
                card.type === 'working' ? 'bg-gradient-to-r from-green-500 to-teal-600' :
                card.type === 'holiday' ? 'bg-gradient-to-r from-orange-500 to-red-500' :
                'bg-gradient-to-r from-blue-500 to-indigo-600'
              }`}>
                <h2 className="text-xl font-semibold text-white">{card.title}</h2>
                <p className="text-white text-opacity-80 text-sm mt-1">
                  {card.type === 'working' && 'Days with attendance'}
                  {card.type === 'holiday' && 'Weekends & holidays'}
                  {card.type === 'summary' && 'Hours breakdown'}
                </p>
              </div>

              {/* Card Body */}
              <div className="p-6 space-y-4">
                {renderCardContent(card)}
              </div>
            </div>
          ))}
        </div>

      </div>
    </MainLayout>
  );
};

export default Dashboard;