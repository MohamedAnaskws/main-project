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
  
  const timerRef = useRef(null);

  // ================= LOAD STATUS =================
  const loadStatus = useCallback(async () => {
    try {
      const res = await getAttendance();
      const data = res?.data || res;

      console.log("Loaded attendance data:", data); // Debug log

      setStatus(data?.status || "NOT_LOGGED_IN");
      setAttendanceData(data);
      
      // Initialize times from server data
      if (data?.totalWorkingTime !== undefined && data?.totalWorkingTime !== null) {
        setWorkingTime(data.totalWorkingTime);
      } else {
        setWorkingTime(0);
      }
      
      if (data?.totalBreakTime !== undefined && data?.totalBreakTime !== null) {
        setBreakTime(data.totalBreakTime);
      } else {
        setBreakTime(0);
      }
    } catch (error) {
      console.error("Failed to load attendance:", error);
      setStatus("NOT_LOGGED_IN");
      setAttendanceData(null);
    }
  }, []);

  // ================= CALCULATE REAL-TIME TIMES =================
  const calculateRealTime = useCallback(() => {
    if (!attendanceData) {
      console.log("No attendance data available");
      return;
    }

    const now = new Date().getTime();
    
    // Check for checkInTime in different possible formats
    let checkInTime = null;
    if (attendanceData.checkInTime) {
      checkInTime = new Date(attendanceData.checkInTime).getTime();
    } else if (attendanceData.check_in_time) {
      checkInTime = new Date(attendanceData.check_in_time).getTime();
    } else if (attendanceData.checkinTime) {
      checkInTime = new Date(attendanceData.checkinTime).getTime();
    }
    
    if (!checkInTime) {
      console.log("No check-in time found in attendance data:", attendanceData);
      return;
    }

    console.log("Calculating real-time:", { status, checkInTime, now }); // Debug log

    if (status === "WORKING") {
      // Calculate total elapsed time since check-in
      const totalElapsed = Math.floor((now - checkInTime) / 1000);
      
      // Get total break time (handle different field names)
      let totalBreakTimeValue = 0;
      if (attendanceData.totalBreakTime !== undefined) {
        totalBreakTimeValue = attendanceData.totalBreakTime || 0;
      } else if (attendanceData.total_break_time !== undefined) {
        totalBreakTimeValue = attendanceData.total_break_time || 0;
      }
      
      // Working time = total elapsed - break time
      const currentWorkingTime = Math.max(0, totalElapsed - totalBreakTimeValue);
      setWorkingTime(currentWorkingTime);
      
      // Keep break time as is
      setBreakTime(totalBreakTimeValue);
      
      console.log("Working time updated:", currentWorkingTime); // Debug log
    } 
    else if (status === "BREAK") {
      // Calculate total elapsed time since check-in
      const totalElapsed = Math.floor((now - checkInTime) / 1000);
      
      // Get total break time before current break
      let totalBreakTimeValue = 0;
      if (attendanceData.totalBreakTime !== undefined) {
        totalBreakTimeValue = attendanceData.totalBreakTime || 0;
      } else if (attendanceData.total_break_time !== undefined) {
        totalBreakTimeValue = attendanceData.total_break_time || 0;
      }
      
      // Calculate working time (excluding current break)
      const workingTimeWithoutCurrentBreak = Math.max(0, totalElapsed - totalBreakTimeValue);
      setWorkingTime(workingTimeWithoutCurrentBreak);
      
      // Calculate current break time including current break session
      let breakStartTime = null;
      if (attendanceData.breakStartTime) {
        breakStartTime = new Date(attendanceData.breakStartTime).getTime();
      } else if (attendanceData.break_start_time) {
        breakStartTime = new Date(attendanceData.break_start_time).getTime();
      } else if (attendanceData.currentBreakStart) {
        breakStartTime = new Date(attendanceData.currentBreakStart).getTime();
      }
      
      if (breakStartTime) {
        const currentBreakDuration = Math.floor((now - breakStartTime) / 1000);
        const totalBreakTime = totalBreakTimeValue + currentBreakDuration;
        setBreakTime(totalBreakTime);
        console.log("Break time updated:", totalBreakTime); // Debug log
      } else {
        setBreakTime(totalBreakTimeValue);
      }
    }
  }, [status, attendanceData]);

  // ================= TIMER EFFECT =================
  useEffect(() => {
    // Clear existing timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Start new timer if user is checked in
    if ((status === "WORKING" || status === "BREAK") && attendanceData) {
      // Check if there's a check-in time
      let hasCheckInTime = false;
      if (attendanceData.checkInTime || attendanceData.check_in_time || attendanceData.checkinTime) {
        hasCheckInTime = true;
      }
      
      if (hasCheckInTime) {
        console.log("Starting timer for status:", status);
        // Calculate immediately
        calculateRealTime();
        
        // Update every second
        timerRef.current = setInterval(() => {
          calculateRealTime();
        }, 1000);
      } else {
        console.log("No check-in time found, timer not started");
      }
    }

    // Cleanup on unmount or status change
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [status, attendanceData, calculateRealTime]);

  // ================= INITIAL LOAD =================
  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // ================= AUTO REFRESH STATUS =================
  useEffect(() => {
    const refreshInterval = setInterval(loadStatus, 20000);
    return () => clearInterval(refreshInterval);
  }, [loadStatus]);

  // ================= ACTION HANDLER =================
  const runAction = async (fn, msgText) => {
    if (loading) return;
    setLoading(true);

    try {
      const res = await fn();

      if (res?.success === false) {
        message.warning(res?.message || "Action failed");
        await loadStatus();
        return;
      }

      message.success(msgText);
      await loadStatus();
    } catch (err) {
      message.error(err?.message || "Request failed");
      console.error("Action error:", err);
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
                onClick={() => runAction(checkIn, "✅ Checked in successfully")}
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
                  onClick={() => runAction(breakStart, "☕ Break started")}
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
                  onClick={() => runAction(checkOut, "👋 Checked out successfully")}
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
                  onClick={() => runAction(breakEnd, "▶️ Resumed work")}
                  style={{ borderRadius: 10, height: 42 }}
                >
                  Resume
                </Button>

                <Button
                  danger
                  loading={loading}
                  onClick={() => runAction(checkOut, "👋 Checked out successfully")}
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