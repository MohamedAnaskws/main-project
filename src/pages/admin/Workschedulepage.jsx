import React, { useEffect, useState } from "react";
import {
  Card,
  Select,
  Calendar,
  Button,
  message,
  Row,
  Col,
  Typography,
  Tag,
  Space,
  Tooltip,
  Alert,
} from "antd";
import { CloseOutlined } from "@ant-design/icons";
import axios from "axios";
import dayjs from "dayjs";
import MainLayout from "@/components/layout/MainLayout";
import { getToken } from "../../utils/auth";

const { Option } = Select;
const { Title, Text } = Typography;

const WorkSchedulePage = () => {
  const BASE = import.meta.env.VITE_API_URL;

  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [selectedLeaveDates, setSelectedLeaveDates] = useState({});
  const [existingSchedule, setExistingSchedule] = useState({});
  const [existingScheduleData, setExistingScheduleData] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(dayjs());
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(false);
  

  const [selectedLeaveCount, setSelectedLeaveCount] = useState(0);
  const [currentMonthKey, setCurrentMonthKey] = useState(dayjs().format("YYYY-MM"));
  const [holidayMap, setHolidayMap] = useState(new Map());
  const [holidayDetailsMap, setHolidayDetailsMap] = useState(new Map());

  const totalDaysInMonth = currentMonth.daysInMonth();

  // ================= API =================
  const api = axios.create({ 
    baseURL: BASE,
    headers: {
      'ngrok-skip-browser-warning': 'true', 
    }
  });

  api.interceptors.request.use((config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    config.headers['ngrok-skip-browser-warning'] = 'true';
    return config;
  });

  // ================= USERS =================
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await api.get("/api/users/");
        setUsers(res.data || []);
      } catch {
        message.error("Failed to load users");
      }
    };
    fetchUsers();
  }, []);

  // ================= HOLIDAYS =================
  const fetchHolidays = async (year, month) => {
    try {
      const res = await api.get(
        `/api/holidays/by-month?year=${year}&month=${month}`
      );
      const holidayData = res.data?.data || [];
      setHolidays(holidayData);
      
      const getHolidayColor = (type) => {
        switch (type?.toLowerCase()) {
          case "public":
            return "#ff4d4f";
          case "national":
            return "#ff7a45";
          case "religious":
            return "#ffa940";
          case "company":
            return "#52c41a";
          default:
            return "#ffc53d";
        }
      };

      const tempHolidayMap = new Map();
      const tempHolidayDetailsMap = new Map();

      holidayData.forEach((h) => {
        let start = dayjs(h.from_date);
        const end = dayjs(h.to_date);

        while (start.isBefore(end) || start.isSame(end)) {
          const dateStr = start.format("YYYY-MM-DD");
          tempHolidayMap.set(dateStr, h);
          tempHolidayDetailsMap.set(dateStr, {
            name: h.holiday_name,
            type: h.holiday_type,
            color: getHolidayColor(h.holiday_type),
          });
          start = start.add(1, "day");
        }
      });

      setHolidayMap(tempHolidayMap);
      setHolidayDetailsMap(tempHolidayDetailsMap);
    } catch {
      setHolidays([]);
      setHolidayMap(new Map());
      setHolidayDetailsMap(new Map());
    }
  };

  useEffect(() => {
    fetchHolidays(currentMonth.year(), currentMonth.month() + 1);
  }, [currentMonth]);

  // ================= USER SCHEDULE =================
  const fetchUserSchedule = async (userId) => {
    try {
      const month = currentMonth.startOf("month").format("YYYY-MM-DD");

      const res = await api.get(
        `/api/work-schedule/user/${userId}?month_year=${month}`
      );

      const list = res.data?.data?.details || [];
      const scheduleInfo = res.data?.data;

      setExistingScheduleData(scheduleInfo);

      const map = {};
      let leaveCount = 0;
      
      list.forEach((d) => {
        map[d.work_date] = d;
        if (d.can_work === false) {
          leaveCount++;
        }
      });

      setExistingSchedule(map);
      setSelectedLeaveCount(leaveCount);
      setSelectedLeaveDates({});
      
    } catch {
      setExistingSchedule({});
      setExistingScheduleData(null);
      setSelectedLeaveCount(0);
    }
  };

  useEffect(() => {
    if (selectedUsers.length === 1) {
      fetchUserSchedule(selectedUsers[0]);
    } else {
      setExistingSchedule({});
      setExistingScheduleData(null);
      setSelectedLeaveCount(0);
      setSelectedLeaveDates({});
    }
  }, [selectedUsers, currentMonth]);

  // Reset selections when month changes
  useEffect(() => {
    const newMonthKey = currentMonth.format("YYYY-MM");
    if (newMonthKey !== currentMonthKey) {
      setCurrentMonthKey(newMonthKey);
      setSelectedLeaveDates({});
      if (selectedUsers.length === 1) {
        fetchUserSchedule(selectedUsers[0]);
      }
    }
  }, [currentMonth]);

  // ================= SATURDAY PATTERN (1,0,1,0,1,0...) =================
  const isSaturdayWorking = (date) => {
    // Get the date
    const dayOfMonth = date.date();
    
    // Calculate which Saturday of the month it is
    let saturdayCount = 0;
    
    // Count how many Saturdays have occurred up to this date
    for (let i = 1; i <= dayOfMonth; i++) {
      const checkDate = dayjs(date.year()).month(date.month()).date(i);
      if (checkDate.day() === 6) { // 6 = Saturday
        saturdayCount++;
        if (i === dayOfMonth) break;
      }
    }
    
    // Pattern: odd number Saturdays (1st, 3rd, 5th) = Work (1)
    // Even number Saturdays (2nd, 4th, 6th) = Off (0)
    return saturdayCount % 2 === 1; // 1st, 3rd, 5th = true (Work), 2nd, 4th, 6th = false (Off)
  };

  // ================= TOGGLE LEAVE DAY =================
  const toggleDate = (date) => {
    const formatted = date.format("YYYY-MM-DD");

    // Only allow clicking on current month dates
    if (date.month() !== currentMonth.month() || date.year() !== currentMonth.year()) {
      message.info("Please navigate to the month you want to edit");
      return;
    }

    // Don't allow clicking if no user selected
    if (selectedUsers.length !== 1) {
      message.warning("Please select an employee first");
      return;
    }

    const isHoliday = holidayMap.has(formatted);
    const isExisting = !!existingSchedule[formatted];
    const isCurrentlySelected = !!selectedLeaveDates[formatted];

    // Handle existing schedule dates
    if (isExisting) {
      const existingItem = existingSchedule[formatted];
      const isCurrentlyLeave = existingItem.can_work === false;
      
      if (isCurrentlyLeave) {
        // Remove from leave days
        setExistingSchedule(prev => ({
          ...prev,
          [formatted]: {
            ...prev[formatted],
            can_work: true
          }
        }));
        setSelectedLeaveCount(prev => prev - 1);
        message.success(`Removed leave from ${date.format("MMMM DD, YYYY")}`);
      } else {
        // Add to leave days
        setExistingSchedule(prev => ({
          ...prev,
          [formatted]: {
            ...prev[formatted],
            can_work: false
          }
        }));
        setSelectedLeaveCount(prev => prev + 1);
        
        if (isHoliday) {
          const holidayInfo = holidayDetailsMap.get(formatted);
          message.success(`Set ${date.format("MMMM DD, YYYY")} (${holidayInfo?.name}) as leave`);
        } else {
          message.success(`Set ${date.format("MMMM DD, YYYY")} as leave`);
        }
      }
      
    } else {
      // Handle new selections (not in existing schedule)
      if (!isCurrentlySelected) {
        // Add new leave day
        setSelectedLeaveDates((prev) => {
          const updated = { 
            ...prev,
            [formatted]: {
              work_date: formatted,
              can_work: false,
              is_holiday: isHoliday,
              status: "active",
            }
          };
          setSelectedLeaveCount(prevCount => prevCount + 1);
          
          if (isHoliday) {
            const holidayInfo = holidayDetailsMap.get(formatted);
            message.success(`Selected ${date.format("MMMM DD, YYYY")} (${holidayInfo?.name}) as leave`);
          } else {
            message.success(`Selected ${date.format("MMMM DD, YYYY")} as leave`);
          }
          
          return updated;
        });
      } else {
        // Remove leave day
        setSelectedLeaveDates((prev) => {
          const updated = { ...prev };
          delete updated[formatted];
          setSelectedLeaveCount(prevCount => prevCount - 1);
          message.info(`Removed leave from ${date.format("MMMM DD, YYYY")}`);
          return updated;
        });
      }
    }
  };

  // ================= REMOVE SINGLE DATE =================
  const removeSelectedDate = (date) => {
    if (existingSchedule[date]) {
      setExistingSchedule(prev => ({
        ...prev,
        [date]: {
          ...prev[date],
          can_work: true
        }
      }));
      setSelectedLeaveCount(prev => prev - 1);
      message.info(`Removed leave from ${dayjs(date).format("MMMM DD, YYYY")}`);
    } else {
      setSelectedLeaveDates((prev) => {
        const updated = { ...prev };
        delete updated[date];
        return updated;
      });
      setSelectedLeaveCount(prev => prev - 1);
      message.info(`Removed leave from ${dayjs(date).format("MMMM DD, YYYY")}`);
    }
  };

  // ================= SUBMIT FULL MONTH =================
  const handleSubmit = async () => {
    if (!selectedUsers.length)
      return message.warning("Select employees");

    const start = currentMonth.startOf("month");
    const days = currentMonth.daysInMonth();

    const fullMonthSchedule = [];

    for (let i = 0; i < days; i++) {
      const date = start.add(i, "day");
      const formatted = date.format("YYYY-MM-DD");
      
      let canWork = true; // Default to working day
      
      // Check in new selections first
      if (selectedLeaveDates[formatted]) {
        canWork = false;
      } 
      // Then check in existing schedule
      else if (existingSchedule[formatted]) {
        canWork = existingSchedule[formatted].can_work;
      }

      fullMonthSchedule.push({
        work_date: formatted,
        can_work: canWork,
        is_holiday: holidayMap.has(formatted),
        status: "active",
      });
    }

    try {
      setLoading(true);

      await api.post("/api/work-schedule/", {
        month_year: start.format("YYYY-MM-DD"),
        employees: selectedUsers.map((id) => ({
          user_id: id,
          schedules: fullMonthSchedule,
        })),
      });

      message.success(`Schedule ${existingScheduleData ? "updated" : "created"} successfully for ${selectedLeaveCount} leave day(s)`);

      await fetchUserSchedule(selectedUsers[0]);
      setSelectedLeaveDates({});
      
    } catch (error) {
      console.error("Submit error:", error);
      message.error("Submit failed: " + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  // ================= CALENDAR CELL RENDER =================
  const fullCellRender = (date) => {
    const formatted = date.format("YYYY-MM-DD");
    const isCurrentMonth = date.month() === currentMonth.month() && date.year() === currentMonth.year();

    const isSunday = date.day() === 0;
    const isSaturday = date.day() === 6;
    const saturdayWork = isSaturdayWorking(date);
    
    const existing = existingSchedule[formatted];
    const selected = !!selectedLeaveDates[formatted];
    const isHoliday = holidayMap.has(formatted);
    const holidayInfo = holidayDetailsMap.get(formatted);

    // Determine if this date is a leave day
    let isLeaveDay = false;
    if (selected) {
      isLeaveDay = true;
    } else if (existing) {
      isLeaveDay = existing.can_work === false;
    }

    let bg = "#fff";
    let border = "1px solid #e8e8e8";
    let textColor = "#1b1b1b";
    let statusText = "";

    // SELECTED LEAVE DAY (RED) - Highest priority
    if (isLeaveDay && isCurrentMonth) {
      bg = "#ff4d4f";
      border = "1px solid #ff4d4f";
      textColor = "#fff";
      statusText = "LEAVE";
    }
    // HOLIDAY (Yellow)
    else if (isHoliday && !isLeaveDay && isCurrentMonth) {
      bg = "#ffc53d";
      border = "1px solid #ffc53d";
      textColor = "#fff";
      statusText = holidayInfo?.name || "HOLIDAY";
    }
    // SUNDAY (Grey)
    else if (isSunday && isCurrentMonth && !isHoliday && !isLeaveDay) {
      bg = "#d9d9d9";
      border = "1px solid #bfbfbf";
      textColor = "#666";
      statusText = "SUN";
    }
    // SATURDAY (Working - Blue, Off - Grey)
    else if (isSaturday && isCurrentMonth && !isHoliday && !isLeaveDay) {
      if (saturdayWork) {
        bg = "#1890ff";
        border = "1px solid #096dd9";
        textColor = "#fff";
        statusText = "WORK";
      } else {
        bg = "#d9d9d9";
        border = "1px solid #bfbfbf";
        textColor = "#666";
        statusText = "OFF";
      }
    }
    // WORKING DAY (Monday to Friday - Blue)
    else if (!isLeaveDay && isCurrentMonth && !isHoliday && !isSunday && !isSaturday) {
      bg = "#1890ff";
      border = "1px solid #096dd9";
      textColor = "#fff";
      statusText = "WORK";
    }
    // Non-current month styling
    else if (!isCurrentMonth) {
      bg = "#fafafa";
      border = "1px solid #f0f0f0";
      textColor = "#999";
      statusText = "LOCKED";
    }

    // ALL days in current month are selectable
    let isSelectable = isCurrentMonth && selectedUsers.length === 1;
    
    const cellContent = (
      <div
        onClick={() => isSelectable && toggleDate(date)}
        style={{
          height: 88,
          borderRadius: 8,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          cursor: isSelectable ? "pointer" : "not-allowed",
          opacity: !isCurrentMonth ? 0.4 : 1,
          background: bg,
          border,
          transition: "all 0.3s ease",
          boxShadow: isLeaveDay ? "0 2px 8px rgba(255,77,79,0.3)" : "none",
        }}
        onMouseEnter={(e) => {
          if (isSelectable) {
            e.currentTarget.style.transform = "scale(1.02)";
            e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.15)";
          }
        }}
        onMouseLeave={(e) => {
          if (isSelectable) {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.boxShadow = isLeaveDay ? "0 2px 8px rgba(255,77,79,0.3)" : "none";
          }
        }}
      >
        <div
          style={{
            fontWeight: "bold",
            color: textColor,
            fontSize: 18,
            marginBottom: 4,
          }}
        >
          {date.date()}
        </div>

        {statusText && (
          <div
            style={{
              fontSize: 10,
              color: textColor,
              fontWeight: "bold",
              textAlign: "center",
              padding: "2px 4px",
              borderRadius: 4,
              background: textColor === "#fff" ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.1)",
            }}
          >
            {statusText}
          </div>
        )}

        {!isCurrentMonth && (
          <div style={{ fontSize: 8, color: "#999", marginTop: 2 }}>Locked</div>
        )}

        {selectedUsers.length !== 1 && isCurrentMonth && (
          <div style={{ fontSize: 8, color: "#999", marginTop: 2 }}>
            Select user
          </div>
        )}
      </div>
    );

    return cellContent;
  };

  // Get all leave dates (existing + new)
  const getAllLeaveDates = () => {
    const allLeaveDates = [];
    
    // Add existing leave dates
    Object.entries(existingSchedule).forEach(([date, schedule]) => {
      if (schedule.can_work === false) {
        allLeaveDates.push(date);
      }
    });
    
    // Add new selected dates
    allLeaveDates.push(...Object.keys(selectedLeaveDates));
    
    return [...new Set(allLeaveDates)].sort();
  };

  // Clear all selected dates (new selections only)
  const clearAllSelectedDates = () => {
    setSelectedLeaveDates({});
    const existingLeaveCount = Object.values(existingSchedule).filter(s => s.can_work === false).length;
    setSelectedLeaveCount(existingLeaveCount);
    message.info("Cleared all new leave selections");
  };

  // Calculate statistics
  const holidayCount = holidayMap.size;
  const allLeaveDates = getAllLeaveDates();
  const totalLeaveDays = allLeaveDates.length;
  const workingDays = totalDaysInMonth - totalLeaveDays - holidayCount;

  // Get Saturday pattern for display
  const getSaturdayPattern = () => {
    const pattern = [];
    for (let i = 1; i <= 6; i++) {
      pattern.push(`${i}${i === 1 ? 'st' : i === 2 ? 'nd' : i === 3 ? 'rd' : 'th'}: ${i % 2 === 1 ? 'WORK' : 'OFF'}`);
    }
    return pattern.join(" | ");
  };

  return (
    <MainLayout>
      <Card>
        <Title level={4}>Work Schedule Management</Title>
        
        {selectedUsers.length !== 1 && (
          <Alert
            message="Please select an employee"
            type="info"
            showIcon
            style={{ marginBottom: 20 }}
          />
        )}

        <Row gutter={16} style={{ marginBottom: 20 }}>
          <Col span={12}>
            <Select
              mode="multiple"
              placeholder="Select employees (choose one to edit schedule)"
              style={{ width: "100%" }}
              value={selectedUsers}
              onChange={setSelectedUsers}
              maxCount={1}
            >
              {users.map((u) => (
                <Option key={u.id} value={u.id}>
                  {u.first_name} {u.last_name}
                </Option>
              ))}
            </Select>
          </Col>
          <Col span={12}>
            <div style={{ background: "#f0f5ff", padding: "12px", borderRadius: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <Text type="secondary">
                  Leave Days: <strong style={{ color: "#ff4d4f" }}>{totalLeaveDays}</strong>
                </Text>
                <Text type="secondary">
                  Working Days: <strong style={{ color: "#1890ff" }}>{workingDays}</strong>
                </Text>
                <Text type="secondary">
                  Holidays: <strong>{holidayCount}</strong>
                </Text>
              </div>
              {totalDaysInMonth > 0 && (
                <>
                  <div style={{ 
                    width: "100%", 
                    background: "#e8e8e8", 
                    borderRadius: 4,
                    overflow: "hidden"
                  }}>
                    <div style={{ 
                      width: `${(totalLeaveDays / totalDaysInMonth) * 100}%`, 
                      background: "#ff4d4f", 
                      height: 8,
                      transition: "width 0.3s"
                    }} />
                  </div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {totalLeaveDays} out of {totalDaysInMonth} days marked as leave
                  </Text>
                </>
              )}
            </div>
          </Col>
        </Row>

       
        {/* Selected Leave Days Display */}
        {allLeaveDates.length > 0 && (
          <Card 
            size="small" 
            style={{ 
              marginBottom: 20, 
              backgroundColor: "#fff1f0",
              borderColor: "#ffccc7"
            }}
          >
            <Row justify="space-between" align="middle">
              <Col>
                <Space direction="vertical" size="small">
                  <Text strong style={{ color: "#ff4d4f" }}>
                    Leave Days ({totalLeaveDays}):
                  </Text>
                  <Space wrap size="small">
                    {allLeaveDates.map((date) => {
                      const isHoliday = holidayMap.has(date);
                      const holidayInfo = holidayDetailsMap.get(date);
                      const isNewSelection = !!selectedLeaveDates[date];
                      const dayName = dayjs(date).format("dddd");
                      return (
                        <Tag
                          key={date}
                          closable
                          onClose={() => removeSelectedDate(date)}
                          color="error"
                          style={{ 
                            padding: "4px 8px",
                            fontSize: "13px",
                            marginBottom: "4px"
                          }}
                          closeIcon={<CloseOutlined style={{ fontSize: "10px" }} />}
                        >
                          {dayjs(date).format("MMM DD")} ({dayName})
                          {isHoliday && holidayInfo && ` 🎉${holidayInfo.name}`}
                          {isNewSelection && " 🆕"}
                        </Tag>
                      );
                    })}
                  </Space>
                </Space>
              </Col>
              {Object.keys(selectedLeaveDates).length > 0 && (
                <Col>
                  <Button 
                    size="small" 
                    onClick={clearAllSelectedDates}
                    danger
                  >
                    Clear New Changes
                  </Button>
                </Col>
              )}
            </Row>
          </Card>
        )}

        <Calendar
          fullscreen
          value={currentMonth}
          onPanelChange={(val) => setCurrentMonth(val)}
          fullCellRender={fullCellRender}
        />

        <div style={{ marginTop: 20, display: "flex", gap: "10px" }}>
          <Button
            type="primary"
            loading={loading}
            onClick={handleSubmit}
            size="large"
            style={{ flex: 1 }}
            disabled={selectedUsers.length !== 1}
          >
            {existingScheduleData ? "Update Schedule" : "Submit Schedule"}
          </Button>
          
          {selectedUsers.length === 1 && (
            <Button
              onClick={() => fetchUserSchedule(selectedUsers[0])}
              size="large"
            >
              Refresh
            </Button>
          )}
        </div>
        
        {/* Legend */}
        <Card size="small" style={{ marginTop: 20, backgroundColor: "#fafafa" }}>
          <Row gutter={16}>
            <Col span={6}>
              <Space>
                <div style={{ width: 20, height: 20, backgroundColor: "#1890ff", borderRadius: 4 }}></div>
                <Text>Working Day</Text>
              </Space>
            </Col>
            <Col span={6}>
              <Space>
                <div style={{ width: 20, height: 20, backgroundColor: "#d9d9d9", borderRadius: 4 }}></div>
                <Text>Off Day </Text>
              </Space>
            </Col>
            <Col span={6}>
              <Space>
                <div style={{ width: 20, height: 20, backgroundColor: "#ff4d4f", borderRadius: 4 }}></div>
                <Text>Leave Day </Text>
              </Space>
            </Col>
            <Col span={6}>
              <Space>
                <div style={{ width: 20, height: 20, backgroundColor: "#ffc53d", borderRadius: 4 }}></div>
                <Text>Holiday</Text>
              </Space>
            </Col>
          </Row>
        </Card>
      </Card>
    </MainLayout>
  );
};

export default WorkSchedulePage;