import React, { useState, useEffect, useCallback, useRef } from "react";
import { Card, Typography, Button, Tag, message } from "antd";
import {
  ClockCircleOutlined,
  CoffeeOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";

import {
  checkIn,
  checkOut,
  breakStart,
  breakEnd,
  getAttendance,
} from "../../services/crm/attendanceApi";

const { Title, Text } = Typography;

function UserDashboard() {
  const [status, setStatus] = useState("NOT_LOGGED_IN");
  const [loading, setLoading] = useState(false);
  const [workingTime, setWorkingTime] = useState(0);
  const [breakTime, setBreakTime] = useState(0);
  const [attendanceData, setAttendanceData] = useState(null);
  const [localBreakStart, setLocalBreakStart] = useState(null);
  const [lastBreakTotal, setLastBreakTotal] = useState(0); // Store last break total
  
  const timerRef = useRef(null);

  // ================= LOAD STATUS =================
  const loadStatus = useCallback(async () => {
    try {
      const res = await getAttendance();
      const data = res?.data || res;

      console.log("Loaded attendance data:", data);

      const newStatus = data?.status || "NOT_LOGGED_IN";
      setStatus(newStatus);
      setAttendanceData(data);
      
      // Initialize times from server data
      let totalWorking = 0;
      let totalBreak = 0;
      
      if (data?.totalWorkingTime !== undefined && data?.totalWorkingTime !== null) {
        totalWorking = data.totalWorkingTime;
      }
      
      if (data?.totalBreakTime !== undefined && data?.totalBreakTime !== null) {
        totalBreak = data.totalBreakTime;
      }
      
      setWorkingTime(totalWorking);
      setBreakTime(totalBreak);
      setLastBreakTotal(totalBreak);
      
      // If status is BREAK, try to get break start time
      if (newStatus === "BREAK") {
        let breakStartTime = null;
        if (data?.breakStartTime) {
          breakStartTime = data.breakStartTime;
        } else if (data?.break_start_time) {
          breakStartTime = data.break_start_time;
        } else if (data?.currentBreakStart) {
          breakStartTime = data.currentBreakStart;
        }
        
        if (breakStartTime) {
          const breakStartMs = new Date(breakStartTime).getTime();
          setLocalBreakStart(breakStartMs);
          // Save to sessionStorage for persistence across route changes
          sessionStorage.setItem('breakStartTime', breakStartMs.toString());
          sessionStorage.setItem('breakStatus', 'BREAK');
          sessionStorage.setItem('breakTotal', totalBreak.toString());
        } else if (!localBreakStart) {
          // Check sessionStorage for saved break data
          const savedBreakStart = sessionStorage.getItem('breakStartTime');
          const savedBreakStatus = sessionStorage.getItem('breakStatus');
          const savedBreakTotal = sessionStorage.getItem('breakTotal');
          
          if (savedBreakStart && savedBreakStatus === 'BREAK') {
            console.log("Restoring break from sessionStorage");
            setLocalBreakStart(parseInt(savedBreakStart));
            if (savedBreakTotal) {
              setLastBreakTotal(parseInt(savedBreakTotal));
              setBreakTime(parseInt(savedBreakTotal));
            }
          } else {
            // If no break start time from server, use current time as fallback
            console.warn("No break start time from server, using local time");
            const now = Date.now();
            setLocalBreakStart(now);
            sessionStorage.setItem('breakStartTime', now.toString());
            sessionStorage.setItem('breakStatus', 'BREAK');
            sessionStorage.setItem('breakTotal', totalBreak.toString());
          }
        }
      } else {
        // Clear sessionStorage when not in break
        setLocalBreakStart(null);
        sessionStorage.removeItem('breakStartTime');
        sessionStorage.removeItem('breakStatus');
        sessionStorage.removeItem('breakTotal');
      }
      
    } catch (error) {
      console.error("Failed to load attendance:", error);
      setStatus("NOT_LOGGED_IN");
      setAttendanceData(null);
      setLocalBreakStart(null);
      sessionStorage.removeItem('breakStartTime');
      sessionStorage.removeItem('breakStatus');
      sessionStorage.removeItem('breakTotal');
    }
  }, []);

  // ================= CALCULATE REAL-TIME TIMES =================
  const calculateRealTime = useCallback(() => {
    if (!attendanceData && status !== "BREAK") {
      console.log("No attendance data available");
      return;
    }

    const now = Date.now();
    
    // Get check-in time
    let checkInTime = null;
    if (attendanceData?.checkInTime) {
      checkInTime = new Date(attendanceData.checkInTime).getTime();
    } else if (attendanceData?.check_in_time) {
      checkInTime = new Date(attendanceData.check_in_time).getTime();
    } else if (attendanceData?.checkinTime) {
      checkInTime = new Date(attendanceData.checkinTime).getTime();
    }
    
    if (!checkInTime) {
      console.log("No check-in time found");
      return;
    }

    // Get total break time from server or last saved total
    let totalBreakTimeFromServer = lastBreakTotal;
    if (attendanceData?.totalBreakTime !== undefined && attendanceData?.totalBreakTime !== null) {
      totalBreakTimeFromServer = attendanceData.totalBreakTime;
    } else if (attendanceData?.total_break_time !== undefined && attendanceData?.total_break_time !== null) {
      totalBreakTimeFromServer = attendanceData.total_break_time;
    }

    // Calculate total elapsed time since check-in
    const totalElapsed = Math.floor((now - checkInTime) / 1000);

    if (status === "WORKING") {
      // Working time = total elapsed - total break time
      const currentWorkingTime = Math.max(0, totalElapsed - totalBreakTimeFromServer);
      setWorkingTime(currentWorkingTime);
      setBreakTime(totalBreakTimeFromServer);
      
      console.log("WORKING - Working:", currentWorkingTime, "Break:", totalBreakTimeFromServer);
    } 
    else if (status === "BREAK") {
      // Get break start time (from state, server, or sessionStorage)
      let breakStartTime = localBreakStart;
      
      // Try to get from server data if local is not available
      if (!breakStartTime && attendanceData?.breakStartTime) {
        breakStartTime = new Date(attendanceData.breakStartTime).getTime();
      } else if (!breakStartTime && attendanceData?.break_start_time) {
        breakStartTime = new Date(attendanceData.break_start_time).getTime();
      } else if (!breakStartTime && attendanceData?.currentBreakStart) {
        breakStartTime = new Date(attendanceData.currentBreakStart).getTime();
      }
      
      // Check sessionStorage as last resort
      if (!breakStartTime) {
        const savedBreakStart = sessionStorage.getItem('breakStartTime');
        if (savedBreakStart) {
          breakStartTime = parseInt(savedBreakStart);
          console.log("Using break start from sessionStorage:", new Date(breakStartTime));
        }
      }
      
      if (breakStartTime) {
        // Calculate current break session duration
        const currentBreakDuration = Math.floor((now - breakStartTime) / 1000);
        // Total break time = previous break time + current break session
        const totalBreakTime = totalBreakTimeFromServer + currentBreakDuration;
        
        // Working time = total elapsed - total break time (including current break)
        const currentWorkingTime = Math.max(0, totalElapsed - totalBreakTime);
        
        setWorkingTime(currentWorkingTime);
        setBreakTime(totalBreakTime);
        
        // Update sessionStorage with latest break total
        sessionStorage.setItem('breakTotal', totalBreakTimeFromServer.toString());
        
        console.log("BREAK - Working:", currentWorkingTime, "Break:", totalBreakTime, "Current session:", currentBreakDuration);
      } else {
        console.error("No break start time available for BREAK state");
        // Fallback: just show server values
        setWorkingTime(Math.max(0, totalElapsed - totalBreakTimeFromServer));
        setBreakTime(totalBreakTimeFromServer);
      }
    }
  }, [status, attendanceData, localBreakStart, lastBreakTotal]);

  // ================= TIMER EFFECT =================
  useEffect(() => {
    // Clear existing timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Start new timer if user is checked in
    if ((status === "WORKING" || status === "BREAK") && (attendanceData || localBreakStart)) {
      console.log("Starting timer for status:", status);
      // Calculate immediately
      calculateRealTime();
      
      // Update every second
      timerRef.current = setInterval(() => {
        calculateRealTime();
      }, 1000);
    }

    // Cleanup on unmount or status change
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [status, attendanceData, localBreakStart, calculateRealTime]);

  // ================= INITIAL LOAD =================
  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // ================= AUTO REFRESH STATUS =================
  useEffect(() => {
    const refreshInterval = setInterval(loadStatus, 20000);
    return () => clearInterval(refreshInterval);
  }, [loadStatus]);

  // Save break data before page unload (when changing routes)
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (status === "BREAK" && localBreakStart) {
        sessionStorage.setItem('breakStartTime', localBreakStart.toString());
        sessionStorage.setItem('breakStatus', 'BREAK');
        sessionStorage.setItem('breakTotal', lastBreakTotal.toString());
        sessionStorage.setItem('attendanceData', JSON.stringify(attendanceData));
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [status, localBreakStart, lastBreakTotal, attendanceData]);

  // ================= ACTION HANDLER =================
  const runAction = async (fn, msgText, actionType) => {
    if (loading) return;
    setLoading(true);

    try {
      console.log(`Executing ${actionType}...`);
      const res = await fn();

      console.log(`${actionType} response:`, res);

      // Check if the response indicates an error
      if (res?.success === false || res?.error) {
        message.warning(res?.message || res?.error || "Action failed");
        await loadStatus();
        return;
      }

      message.success(msgText);
      
      // Special handling for break start
      if (actionType === "breakStart") {
        // Set local break start time immediately for real-time updates
        const breakStartTime = Date.now();
        setLocalBreakStart(breakStartTime);
        setLastBreakTotal(breakTime); // Save current break total
        
        // Save to sessionStorage for persistence
        sessionStorage.setItem('breakStartTime', breakStartTime.toString());
        sessionStorage.setItem('breakStatus', 'BREAK');
        sessionStorage.setItem('breakTotal', breakTime.toString());
        
        console.log("Set local break start time:", new Date(breakStartTime));
        
        // Update status locally for immediate UI response
        setStatus("BREAK");
      }
      
      // Special handling for break end
      if (actionType === "breakEnd") {
        // Clear local break start and sessionStorage
        setLocalBreakStart(null);
        sessionStorage.removeItem('breakStartTime');
        sessionStorage.removeItem('breakStatus');
        sessionStorage.removeItem('breakTotal');
        
        // Update status locally
        setStatus("WORKING");
      }
      
      // Special handling for check in
      if (actionType === "checkIn") {
        setStatus("WORKING");
        sessionStorage.removeItem('breakStartTime');
        sessionStorage.removeItem('breakStatus');
        sessionStorage.removeItem('breakTotal');
      }
      
      // Special handling for check out
      if (actionType === "checkOut") {
        setStatus("NOT_LOGGED_IN");
        setLocalBreakStart(null);
        sessionStorage.removeItem('breakStartTime');
        sessionStorage.removeItem('breakStatus');
        sessionStorage.removeItem('breakTotal');
        sessionStorage.removeItem('attendanceData');
        
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      }
      
      // Wait a moment and reload from server to sync
      setTimeout(async () => {
        await loadStatus();
        calculateRealTime();
      }, 500);
      
    } catch (err) {
      console.error(`${actionType} error:`, err);
      message.error(err?.response?.data?.message || err?.message || "Request failed");
      // Reload status even on error to ensure consistency
      await loadStatus();
    } finally {
      setLoading(false);
    }
  };

  // ================= FORMAT TIME =================
  const formatTime = (sec) => {
    if (isNaN(sec) || sec < 0) sec = 0;
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 bg-[#fff] pb-2">
      {/* Working Time Card */}
      <Card
        style={{
          borderRadius: 14,
          borderLeft: "4px solid #2563eb",
        }}
      >
        <div className="flex items-center gap-3">
          <ClockCircleOutlined style={{ fontSize: 22, color: "#2563eb" }} />
          <div>
            <Text type="secondary">Working Time</Text>
            <Title level={5} style={{ margin: 0 }}>
              {formatTime(workingTime)}
            </Title>
          </div>
        </div>
      </Card>

      {/* Break Time Card */}
      <Card
        className="shadow-sm hover:shadow-md transition"
        style={{
          borderRadius: 14,
          borderLeft: "4px solid #f59e0b",
        }}
      >
        <div className="flex items-center gap-3">
          <CoffeeOutlined style={{ fontSize: 22, color: "#f59e0b" }} />
          <div>
            <Text type="secondary">Break Time</Text>
            <Title level={5} style={{ margin: 0 }}>
              {formatTime(breakTime)}
            </Title>
          </div>
        </div>
      </Card>

      {/* Status Card */}
      <Card
        className="shadow-sm hover:shadow-md transition"
        style={{
          borderRadius: 14,
          borderLeft: "4px solid #10b981",
        }}
      >
        <div className="flex items-center gap-3">
          <CheckCircleOutlined style={{ fontSize: 22, color: "#10b981" }} />
          <div>
            <Text type="secondary">Status</Text>
            <div>
              <Tag
                color={
                  status === "WORKING"
                    ? "green"
                    : status === "BREAK"
                    ? "orange"
                    : "default"
                }
                style={{
                  borderRadius: 20,
                  padding: "2px 10px",
                  fontWeight: 500,
                }}
              >
                {status === "NOT_LOGGED_IN" ? "NOT CHECKED IN" : status}
              </Tag>
            </div>
          </div>
        </div>
      </Card>

      {/* Action Buttons Card */}
      <Card
        className="shadow-sm"
        style={{
          borderRadius: 14,
          border: "1px solid #eef2f7",
        }}
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex flex-wrap gap-3">
            {status === "NOT_LOGGED_IN" && (
              <Button
                type="primary"
                loading={loading}
                onClick={() => runAction(checkIn, "✅ Checked in successfully", "checkIn")}
                style={{
                  borderRadius: 10,
                  height: 42,
                  background: "#2563eb",
                }}
              >
                Check In
              </Button>
            )}

            {status === "WORKING" && (
              <>
                <Button
                  loading={loading}
                  onClick={() => runAction(breakStart, "☕ Break started", "breakStart")}
                  style={{
                    borderRadius: 10,
                    height: 42,
                    background: "#f59e0b",
                    color: "#fff",
                    border: "none",
                  }}
                >
                  <CoffeeOutlined /> Break
                </Button>

                <Button
                  danger
                  loading={loading}
                  onClick={() => runAction(checkOut, "👋 Checked out successfully", "checkOut")}
                  style={{ borderRadius: 10, height: 42 }}
                >
                  Check Out
                </Button>
              </>
            )}

            {status === "BREAK" && (
              <>
                <Button
                  type="primary"
                  loading={loading}
                  onClick={() => runAction(breakEnd, "▶️ Resumed work", "breakEnd")}
                  style={{ borderRadius: 10, height: 42 }}
                >
                  Resume
                </Button>

                <Button
                  danger
                  loading={loading}
                  onClick={() => runAction(checkOut, "👋 Checked out successfully", "checkOut")}
                  style={{ borderRadius: 10, height: 42 }}
                >
                  Check Out
                </Button>
              </>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

export default UserDashboard;