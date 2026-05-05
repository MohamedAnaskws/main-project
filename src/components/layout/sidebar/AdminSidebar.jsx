import React, { useState } from "react";
import { Menu } from "antd";
import { useNavigate, useLocation } from "react-router-dom";

import Logo from "../../../assets/logo.webp";
import { ADMIN_MENU } from "../../../config/menuConfig";
import { filterMenuByRole } from "../../../utils/menuFilter";
import { getUser } from "../../../utils/auth";

function AdminSidebar({ collapsed }) {
  const navigate = useNavigate();
  const location = useLocation();

  const user = getUser();
  const roleId = user?.roleid;

  const menuItems = filterMenuByRole(ADMIN_MENU, roleId);

  const [openKeys, setOpenKeys] = useState(["hr"]);

  return (
    <div
      style={{
        height: "100%",
        background: "linear-gradient(180deg, #1a1e2b 0%, #0f1119 100%)",
        display: "flex",
        flexDirection: "column",
        boxShadow: "4px 0 12px rgba(0, 0, 0, 0.1)",
        overflow: "hidden",
      }}
    >
      {/* LOGO - Only show when not collapsed */}
      {!collapsed && (
        <div
          style={{
            padding: "21px 16px 21px",
            textAlign: "center",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            background: "#fffffff3",
          }}
        >
          <img
            src={Logo}
            alt="logo"
            style={{
              height: "40px",
              transition: "all 0.3s ease",
              opacity: 0.95,
            }}
          />
        </div>
      )}

      {/* Optional: Show a mini logo when collapsed */}
      {collapsed && (
        <div
          style={{
            padding: "24px 0",
            textAlign: "center",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div
            style={{
              width: "32px",
              height: "32px",
              margin: "0 auto",
              background: `url(${Logo}) center/contain no-repeat`,
              opacity: 0.8,
            }}
          />
        </div>
      )}

      <Menu
        mode="inline"
        theme="dark"
        items={menuItems}
        selectedKeys={[location.pathname]}
        openKeys={collapsed ? [] : openKeys}
        onOpenChange={setOpenKeys}
        onClick={(e) => navigate(e.key)}
        style={{
          background: "transparent",
          borderRight: "none",
          flex: 1,
          paddingRight: "6px",
          overflowX: "hidden",
          marginTop: "5px",
        }}
      />
    </div>
  );
}

export default AdminSidebar;