import React, { useEffect, useState, useMemo, useCallback } from "react";
import { Table, Tag, Card, Tabs, Button, Select, Input, message, Tooltip, Progress, Badge } from "antd";
import { InfoCircleOutlined, CalendarOutlined } from "@ant-design/icons";
import axios from "axios";
import MainLayout from "../../components/layout/MainLayout";
import { getToken, getUser } from "../../utils/auth";
import dayjs from "dayjs";

const { Option } = Select;

const CombinedApprovalsPage = () => {
  const BASE = import.meta.env.VITE_API_URL;

  const currentUser = getUser();
  const roleId = currentUser?.roleid;

  const roleStepMap = {
    1: 3,
    2: 2,
    3: 1,
  };

  const allowedStep = roleStepMap[roleId];

  const [pending, setPending] = useState([]);
  const [processing, setProcessing] = useState([]);
  const [approved, setApproved] = useState([]);
  const [rejected, setRejected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [updates, setUpdates] = useState({});

  // Users state
  const [users, setUsers] = useState([]);

  // ================= API =================
  const api = useMemo(() => {
    const instance = axios.create({
      baseURL: BASE,
      headers: {
        Accept: "application/json",
        "ngrok-skip-browser-warning": "true",
        "Content-Type": "application/json",
      },
    });

    instance.interceptors.request.use((config) => {
      const token = getToken();

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      config.headers["ngrok-skip-browser-warning"] = "true";

      return config;
    });

    return instance;
  }, [BASE]);

  // ================= FETCH USERS =================
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
  }, [api]);

  // Create user map (id → user)
  const userMap = useMemo(() => {
    const map = {};
    users.forEach((u) => {
      map[u.id] = u;
    });
    return map;
  }, [users]);

  // ================= HELPERS =================
  const getStepName = (step) => {
    if (step === 3) return "Owner";
    if (step === 2) return "Manager";
    if (step === 1) return "Department Manager";
    return "Unknown";
  };

  const statusTag = (s) => {
    if (s === "APPROVED") return <Tag color="green">APPROVED</Tag>;
    if (s === "REJECTED") return <Tag color="red">REJECTED</Tag>;
    if (s === "PROCESSING") return <Tag color="blue">PROCESSING</Tag>;
    return <Tag color="orange">PENDING</Tag>;
  };

  const getEmployeeName = (record) => {
    const emp = record?.employee;
    if (!emp) return "Unknown";
    return `${emp.first_name || ""} ${emp.last_name || ""}`.trim();
  };

  // Get remaining paid days from the API response
  const getRemainingPaidDays = (record) => {
    const emp = record?.employee;
    if (!emp?.casual_leave_quota) return null;
    return emp.casual_leave_quota.remaining_paid_days_in_current_period;
  };

  const getTotalAllowedDays = (record) => {
    const emp = record?.employee;
    if (!emp?.casual_leave_quota) return 6;
    return emp.casual_leave_quota.total_allowed_paid_days_per_year;
  };

  const getUsedPaidDays = (record) => {
    const emp = record?.employee;
    if (!emp?.casual_leave_quota) return 0;
    return emp.casual_leave_quota.used_paid_days_in_current_period;
  };

  const getQuotaPeriod = (record) => {
    const emp = record?.employee;
    if (!emp?.casual_leave_quota) return null;
    return {
      start: emp.casual_leave_quota.current_period_start,
      end: emp.casual_leave_quota.current_period_end,
      basis: emp.casual_leave_quota.calculation_basis,
    };
  };

  // ================= FETCH LEAVES =================
  const fetchData = useCallback(async () => {
    setLoading(true);

    try {
      const [p, a, r] = await Promise.all([
        api.get("/api/leaves/status/PENDING"),
        api.get("/api/leaves/status/APPROVED"),
        api.get("/api/leaves/status/REJECTED"),
      ]);

      const pendingData = p.data?.data || [];
      const approvedData = a.data?.data || [];
      const rejectedData = r.data?.data || [];

      const filteredPending = pendingData.filter(
        (item) => Number(item.current_step) === Number(allowedStep)
      );

      setPending(filteredPending);
      setProcessing(pendingData);
      setApproved(approvedData);
      setRejected(rejectedData);
    } catch (err) {
      console.error(err);
      message.error("Approvals load failed");
    } finally {
      setLoading(false);
    }
  }, [api, allowedStep]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ================= COLUMNS =================
  const columns = (isAction) => [
    {
      title: "Employee",
      width: 180,
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 600 }}>{getEmployeeName(r)}</div>
        </div>
      ),
    },

    {
      title: "Joining Date",
      width: 120,
      render: (_, record) => {
        const empId = record?.employee?.id;
        const user = userMap[empId];

        return user?.joining_date
          ? dayjs(user.joining_date).format("DD MMM YYYY")
          : "-";
      },
    },

    {
      title: (
        <span>
          Leave Balance
          <Tooltip title="Remaining paid leave days for current period">
            <InfoCircleOutlined style={{ marginLeft: 8, color: "#999" }} />
          </Tooltip>
        </span>
      ),
      width: 180,
      render: (_, record) => {
        const remaining = getRemainingPaidDays(record);
        const total = getTotalAllowedDays(record);
        const used = getUsedPaidDays(record);
        
        if (remaining === null) return "-";
        
        const percent = (used / total) * 100;
        
        return (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 12 }}>
                <Badge status="success" /> {remaining} / {total} days left
              </span>
              <span style={{ fontSize: 12, color: remaining < 3 ? "#ff4d4f" : "#52c41a" }}>
                {used} used
              </span>
            </div>
            <Progress 
              percent={percent} 
              size="small" 
              strokeColor={remaining < 3 ? "#ff4d4f" : "#52c41a"}
              showInfo={false}
            />
            {remaining < 3 && remaining > 0 && (
              <div style={{ fontSize: 10, color: "#ff4d4f", marginTop: 4 }}>
                ⚠️ Low balance
              </div>
            )}
            {remaining === 0 && (
              <div style={{ fontSize: 10, color: "#ff4d4f", marginTop: 4 }}>
                ❌ No leave days remaining
              </div>
            )}
          </div>
        );
      },
    },

    {
      title: "Date",
      dataIndex: "leave_date",
      width: 110,
      render: (date) => dayjs(date).format("DD MMM YYYY"),
    },
    
    { 
      title: "Category", 
      dataIndex: "leave_category",
      width: 100,
      render: (category) => {
        const colors = {
          SICK: "red",
          CASUAL: "blue",
          GENERAL: "green",
          ANNUAL: "purple",
          EMERGENCY: "orange",
        };
        return <Tag color={colors[category] || "default"}>{category}</Tag>;
      },
    },
    
    { 
      title: "Days", 
      dataIndex: "total_days",
      width: 60,
      align: "center",
    },
    
    { 
      title: "Reason", 
      dataIndex: "reason",
      width: 200,
      ellipsis: true,
      render: (reason) => (
        <Tooltip title={reason}>
          <span>{reason?.length > 50 ? reason.substring(0, 50) + "..." : reason}</span>
        </Tooltip>
      ),
    },

    {
      title: "Step",
      width: 150,
      render: (_, r) => (
        <Tag color="blue">
          {r.current_step} - {getStepName(Number(r.current_step))}
        </Tag>
      ),
    },

    {
      title: "Status",
      width: 100,
      render: (_, r) => statusTag(r.status),
    },

    ...(isAction
      ? [
          {
            title: "Decision",
            width: 130,
            render: (_, record) => (
              <Select
                style={{ width: 120 }}
                placeholder="Action"
                onChange={(val) =>
                  setUpdates((p) => ({
                    ...p,
                    [record.id]: { ...p[record.id], status: val },
                  }))
                }
              >
                <Option value="APPROVED">Approve</Option>
                <Option value="REJECTED">Reject</Option>
              </Select>
            ),
          },
          {
            title: "Payment",
            width: 130,
            render: (_, record) => {
              const remaining = getRemainingPaidDays(record);
              const isUnpaidDisabled = remaining === 0;
              
              return (
                <Select
                  style={{ width: 120 }}
                  placeholder="Payment"
                  onChange={(val) =>
                    setUpdates((p) => ({
                      ...p,
                      [record.id]: {
                        ...p[record.id],
                        leave_payment_type: val,
                      },
                    }))
                  }
                >
                  <Option value="PAID">Paid</Option>
                  <Option value="UNPAID" disabled={isUnpaidDisabled}>
                    Unpaid {isUnpaidDisabled && "(No balance)"}
                  </Option>
                </Select>
              );
            },
          },
          {
            title: "Remarks",
            width: 150,
            render: (_, record) => (
              <Input
                placeholder="Remarks"
                onChange={(e) =>
                  setUpdates((p) => ({
                    ...p,
                    [record.id]: {
                      ...p[record.id],
                      remarks: e.target.value,
                    },
                  }))
                }
              />
            ),
          },
          {
            title: "Action",
            width: 100,
            render: (_, record) => (
              <Button
                type="primary"
                size="small"
                onClick={async () => {
                  const u = updates[record.id];

                  if (!u?.status)
                    return message.warning("Select action");

                  if (!u?.leave_payment_type)
                    return message.warning("Select payment");

                  // Check if trying to approve as paid when no balance
                  if (u.status === "APPROVED" && u.leave_payment_type === "PAID") {
                    const remaining = getRemainingPaidDays(record);
                    if (remaining === 0) {
                      return message.error("Cannot approve as PAID. Employee has no remaining paid leave balance.");
                    }
                  }

                  try {
                    await api.post("/api/leaves/approve", {
                      leave_id: record.id,
                      status: u.status,
                      remarks: u.remarks || "",
                      leave_payment_type: u.leave_payment_type,
                    });

                    message.success("Updated");
                    fetchData();
                  } catch (err) {
                    message.error(err?.response?.data?.detail || "Failed");
                  }
                }}
              >
                Submit
              </Button>
            ),
          },
        ]
      : []),
  ];

  // Quota info component for tooltip
  const QuotaInfo = ({ record }) => {
    const quota = getQuotaPeriod(record);
    if (!quota) return null;
    
    return (
      <div style={{ padding: 8 }}>
        <div style={{ marginBottom: 8 }}>
          <CalendarOutlined style={{ marginRight: 8, color: "#1890ff" }} />
          <strong>Leave Period</strong>
        </div>
        <div style={{ fontSize: 12 }}>
          <div>📅 From: {dayjs(quota.start).format("DD MMM YYYY")}</div>
          <div>📅 To: {dayjs(quota.end).format("DD MMM YYYY")}</div>
          <div style={{ marginTop: 8, color: "#666", fontSize: 11 }}>
            {quota.basis}
          </div>
        </div>
      </div>
    );
  };

  // ================= TABS =================
  const items = [
    {
      key: "1",
      label: `Pending (${pending.length})`,
      children: (
        <Table 
          rowKey="id" 
          columns={columns(true)} 
          dataSource={pending} 
          loading={loading}
          scroll={{ x: 1300 }}
          pagination={{ pageSize: 10, showTotal: (total) => `Total ${total} items` }}
        />
      ),
    },
    {
      key: "2",
      label: `Processing (${processing.length})`,
      children: (
        <Table 
          rowKey="id" 
          columns={columns(false)} 
          dataSource={processing} 
          loading={loading}
          scroll={{ x: 1100 }}
          pagination={{ pageSize: 10, showTotal: (total) => `Total ${total} items` }}
        />
      ),
    },
    {
      key: "3",
      label: `Approved (${approved.length})`,
      children: (
        <Table 
          rowKey="id" 
          columns={columns(false)} 
          dataSource={approved} 
          loading={loading}
          scroll={{ x: 1100 }}
          pagination={{ pageSize: 10, showTotal: (total) => `Total ${total} items` }}
        />
      ),
    },
    {
      key: "4",
      label: `Rejected (${rejected.length})`,
      children: (
        <Table 
          rowKey="id" 
          columns={columns(false)} 
          dataSource={rejected} 
          loading={loading}
          scroll={{ x: 1100 }}
          pagination={{ pageSize: 10, showTotal: (total) => `Total ${total} items` }}
        />
      ),
    },
  ];

  return (
    <MainLayout>
      <Card 
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span>Leave Approvals</span>
            <Tooltip title="View and manage leave requests across all employees">
              <InfoCircleOutlined style={{ color: "#999" }} />
            </Tooltip>
          </div>
        }
      >
        <Tabs items={items} />
      </Card>
    </MainLayout>
  );
};

export default CombinedApprovalsPage;