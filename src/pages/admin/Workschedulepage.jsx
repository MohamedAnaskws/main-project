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
  const maxLeaveDays = 6; 

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

  // ================= SATURDAY PATTERN (for display only) =================
  const getSaturdayStatus = (date) => {
    const firstDay = date.startOf("month");
    let firstSaturday = null;
    
    for (let i = 0; i < 7; i++) {
      const checkDate = firstDay.add(i, "day");
      if (checkDate.day() === 6) {
        firstSaturday = checkDate;
        break;
      }
    }
    
    if (!firstSaturday) return false;
    
    const diffDays = date.diff(firstSaturday, "day");
    if (diffDays < 0) return false;
    
    const saturdayIndex = Math.floor(diffDays / 7);
    return saturdayIndex % 2 === 0;
  };

  // ================= TOGGLE LEAVE DAY =================
  const toggleDate = (date) => {
    const formatted = date.format("YYYY-MM-DD");

    // Only allow clicking on current month dates
    if (date.month() !== currentMonth.month() || date.year() !== currentMonth.year()) {
      message.info("Please navigate to the month you want to edit");
      return;
    }

    const isHoliday = holidayMap.has(formatted);
    const isExisting = !!existingSchedule[formatted];
    const isCurrentlySelected = !!selectedLeaveDates[formatted];

    // HOLIDAYS ARE SELECTABLE
    if (isHoliday && !isCurrentlySelected) {
      const holidayInfo = holidayDetailsMap.get(formatted);
      message.info(`Selected holiday "${holidayInfo?.name}" as leave day`);
    }

    let currentLeaveCount = selectedLeaveCount;
    
    if (isExisting) {
      // Toggle existing schedule
      const existingItem = existingSchedule[formatted];
      const isCurrentlyLeave = existingItem.can_work === false;
      
      if (isCurrentlyLeave) {
        // Remove from leave days
        if (currentLeaveCount <= 0) return;
        currentLeaveCount--;
        
        setExistingSchedule(prev => ({
          ...prev,
          [formatted]: {
            ...prev[formatted],
            can_work: true
          }
        }));
      } else {
        // Add to leave days
        if (currentLeaveCount >= maxLeaveDays) {
          message.error(`Maximum ${maxLeaveDays} leave days allowed per month.`);
          return;
        }
        currentLeaveCount++;
        
        setExistingSchedule(prev => ({
          ...prev,
          [formatted]: {
            ...prev[formatted],
            can_work: false
          }
        }));
      }
      setSelectedLeaveCount(currentLeaveCount);
      
    } else {
      // New selection (not in existing schedule)
      if (!isCurrentlySelected && selectedLeaveCount >= maxLeaveDays) {
        message.error(`Maximum ${maxLeaveDays} leave days reached! You can only select ${maxLeaveDays} leave days this month.`);
        return;
      }

      setSelectedLeaveDates((prev) => {
        const updated = { ...prev };

        if (updated[formatted]) {
          delete updated[formatted];
          setSelectedLeaveCount(prev => prev - 1);
        } else {
          updated[formatted] = {
            work_date: formatted,
            can_work: false,
            is_holiday: isHoliday,
            status: "active",
          };
          const newCount = selectedLeaveCount + 1;
          setSelectedLeaveCount(newCount);
          
          if (newCount === maxLeaveDays) {
            message.success(`You have selected all ${maxLeaveDays} leave days.`);
          }
        }

        return updated;
      });
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
    } else {
      setSelectedLeaveDates((prev) => {
        const updated = { ...prev };
        delete updated[date];
        return updated;
      });
      setSelectedLeaveCount(prev => prev - 1);
    }
  };

  // ================= SUBMIT FULL MONTH =================
  const handleSubmit = async () => {
    if (!selectedUsers.length)
      return message.warning("Select employees");

    // Validate exact leave days
    if (selectedLeaveCount !== maxLeaveDays) {
      message.error(`You must select exactly ${maxLeaveDays} leave days. Currently you have selected ${selectedLeaveCount} leave days. Need ${maxLeaveDays - selectedLeaveCount} more.`);
      return;
    }

    const start = currentMonth.startOf("month");
    const days = currentMonth.daysInMonth();

    const fullMonthSchedule = [];

    for (let i = 0; i < days; i++) {
      const date = start.add(i, "day");
      const formatted = date.format("YYYY-MM-DD");
      
      let canWork = true; // Default to working day
      
      if (selectedLeaveDates[formatted]) {
        canWork = false;
      } else if (existingSchedule[formatted]) {
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

      message.success("Schedule created/updated successfully");

      await fetchUserSchedule(selectedUsers[0]);
      setSelectedLeaveDates({});
      
    } catch {
      message.error("Submit failed");
    } finally {
      setLoading(false);
    }
  };

  // ================= CALENDAR CELL =================
  const fullCellRender = (date) => {
    const formatted = date.format("YYYY-MM-DD");
    const isCurrentMonth = date.month() === currentMonth.month() && date.year() === currentMonth.year();

    const isSunday = date.day() === 0;
    const isSaturday = date.day() === 6;
    const saturdayWorking = getSaturdayStatus(date);

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

    const disabled = !isCurrentMonth;

    let bg = "#fff";
    let border = "1px solid #e8e8e8";
    let textColor = "#1b1b1b";

    // SELECTED LEAVE DAY (RED) - Highest priority
    if (isLeaveDay && isCurrentMonth) {
      bg = "#ff4d4f";
      border = "1px solid #ff4d4f";
      textColor = "#fff";
    }
    // HOLIDAY (different colors based on holiday type)
    else if (isHoliday && !isLeaveDay && isCurrentMonth) {
      bg = holidayInfo?.color || "#ffc53d";
      border = `2px solid ${holidayInfo?.color || "#ffc53d"}`;
      textColor = "#fff";
    }
    // OFF DAY (GREY) - Non-selected, non-working days (Sundays, off Saturdays)
    else if ((isSunday || (isSaturday && !saturdayWorking)) && !isLeaveDay && isCurrentMonth && !isHoliday) {
      bg = "#f0f0f0";
      border = "1px solid #d9d9d9";
      textColor = "#999";
    }
    // WORKING DAY (GREEN)
    else if (!isLeaveDay && isCurrentMonth && !isHoliday) {
      bg = "#52c41a";
      border = "1px solid #389e0d";
      textColor = "#fff";
    }
    // Non-current month styling
    else if (!isCurrentMonth) {
      bg = "#fafafa";
      border = "1px solid #f0f0f0";
      textColor = "#999";
    }

    const wouldExceedLimit = !isLeaveDay && !isHoliday && selectedLeaveCount >= maxLeaveDays && isCurrentMonth;
    
    let isSelectable = true;
    if (!isCurrentMonth) isSelectable = false;
    if (wouldExceedLimit) isSelectable = false;
    
    const isDisabled = !isSelectable;

    const cellContent = (
      <div
        onClick={() => isSelectable && toggleDate(date)}
        style={{
          height: 78,
          borderRadius: 8,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          cursor: isDisabled ? "not-allowed" : "pointer",
          opacity: !isCurrentMonth ? 0.4 : (wouldExceedLimit ? 0.6 : 1),
          background: bg,
          border,
          transition: "all 0.3s ease",
        }}
      >
        <div
          style={{
            fontWeight: 500,
            color: textColor,
            fontSize: 16,
          }}
        >
          {date.date()}
        </div>

        {isHoliday && holidayInfo && !isLeaveDay && (
          <Tooltip title={`${holidayInfo.name} (${holidayInfo.type}) - Click to select as leave`}>
            <div style={{ fontSize: 9, color: "#fff", textAlign: "center", padding: "0 4px" }}>
              {holidayInfo.name.length > 10 
                ? `${holidayInfo.name.substring(0, 8)}...` 
                : holidayInfo.name}
            </div>
          </Tooltip>
        )}

        {isHoliday && holidayInfo && isLeaveDay && (
          <Tooltip title={`${holidayInfo.name} - Selected as leave`}>
            <div style={{ fontSize: 9, color: "#fff", textAlign: "center", padding: "0 4px" }}>
              Leave
            </div>
          </Tooltip>
        )}

        {!isHoliday && isSaturday && !isLeaveDay && isCurrentMonth && (
          <div style={{ fontSize: 9, color: saturdayWorking ? "#52c41a" : "#999" }}>
            {saturdayWorking ? "Work" : "Off"}
          </div>
        )}

        {!isHoliday && isSunday && !isLeaveDay && isCurrentMonth && (
          <div style={{ fontSize: 9, color: "#999" }}>
            Off
          </div>
        )}

        {isLeaveDay && !isHoliday && (
          <div style={{ fontSize: 10, color: "#fff" }}>
            Leave
          </div>
        )}

        {!isLeaveDay && !isHoliday && isCurrentMonth && (
          <div style={{ fontSize: 10, color: "#fff" }}>
            Work
          </div>
        )}

        {!isCurrentMonth && (
          <div style={{ fontSize: 8, color: "#999", marginTop: 2 }}>Locked</div>
        )}

        {wouldExceedLimit && (
          <Tooltip title={`Maximum ${maxLeaveDays} leave days reached`}>
            <div style={{ fontSize: 8, color: "#ff4d4f", marginTop: 2 }}>🔒</div>
          </Tooltip>
        )}
      </div>
    );

    return cellContent;
  };

  // Get selected dates list in sorted order (for new selections only)
  const getSelectedDatesList = () => {
    return Object.keys(selectedLeaveDates).sort();
  };

  // Clear all selected dates (new selections only)
  const clearAllSelectedDates = () => {
    setSelectedLeaveDates({});
    const existingLeaveCount = Object.values(existingSchedule).filter(s => s.can_work === false).length;
    setSelectedLeaveCount(existingLeaveCount);
  };

  // Calculate statistics
  const holidayCount = holidayMap.size;
  const workingDays = totalDaysInMonth - selectedLeaveCount - holidayCount;
  const leavePercentage = (selectedLeaveCount / maxLeaveDays) * 100;
  const remainingLeaveDays = maxLeaveDays - selectedLeaveCount;

  return (
    <MainLayout>
      <Card>
        <Title level={4}>Work Schedule</Title>

        <Row gutter={16} style={{ marginBottom: 20 }}>
          <Col span={12}>
            <Select
              mode="multiple"
              placeholder="Select employees"
              style={{ width: "100%" }}
              value={selectedUsers}
              onChange={setSelectedUsers}
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
                <Text type="secondary">Leave Days: <strong style={{ color: "#ff4d4f" }}>{selectedLeaveCount}</strong> / {maxLeaveDays}</Text>
                <Text type="secondary">Working Days: <strong style={{ color: "#52c41a" }}>{workingDays}</strong></Text>
                <Text type="secondary">Holidays: <strong>{holidayCount}</strong></Text>
              </div>
              <div style={{ 
                width: "100%", 
                background: "#e8e8e8", 
                borderRadius: 4,
                overflow: "hidden"
              }}>
                <div style={{ 
                  width: `${(selectedLeaveCount / maxLeaveDays) * 100}%`, 
                  background: "#ff4d4f", 
                  height: 8,
                  transition: "width 0.3s"
                }} />
              </div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {selectedLeaveCount === maxLeaveDays 
                  ? "✓ All leave days selected" 
                  : `Need ${remainingLeaveDays} more leave day(s)`}
              </Text>
            </div>
          </Col>
        </Row>

        {/* Selected Leave Days Display */}
        {Object.keys(selectedLeaveDates).length > 0 && (
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
                    Selected Leave Days ({selectedLeaveCount} / {maxLeaveDays}):
                  </Text>
                  <Space wrap size="small">
                    {getSelectedDatesList().map((date) => {
                      const isHoliday = holidayMap.has(date);
                      const holidayInfo = holidayDetailsMap.get(date);
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
                          {dayjs(date).format("dddd, MMM DD, YYYY")}
                          {isHoliday && holidayInfo && ` (${holidayInfo.name})`}
                        </Tag>
                      );
                    })}
                  </Space>
                </Space>
              </Col>
              <Col>
                <Button 
                  size="small" 
                  onClick={clearAllSelectedDates}
                  danger
                >
                  Clear Changes
                </Button>
              </Col>
            </Row>
          </Card>
        )}

        <Calendar
          fullscreen
          value={currentMonth}
          onPanelChange={(val) => setCurrentMonth(val)}
          fullCellRender={fullCellRender}
        />

        <Button
          type="primary"
          block
          loading={loading}
          style={{ marginTop: 20 }}
          onClick={handleSubmit}
          size="large"
          disabled={selectedLeaveCount !== maxLeaveDays}
        >
        {existingScheduleData ? "Update Schedule" : "Submit Schedule"} 
        </Button>
      </Card>
    </MainLayout>
  );
};

export default WorkSchedulePage;