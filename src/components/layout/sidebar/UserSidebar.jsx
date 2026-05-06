import React from "react";
import { Menu } from "antd";
import { useNavigate, useLocation } from "react-router-dom";
import Logo from "../../../assets/logo.webp";

import { USER_MENU } from "../../../config/menuConfig";
import { filterMenuByRole } from "../../../utils/menuFilter";

function UserSidebar({ collapsed }) {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = filterMenuByRole(USER_MENU);

  // Handle menu click - Force reload for chat
  const handleMenuClick = (key) => {
    if (key === '/chat') {
      // Force full page reload for chat
      window.location.href = '/chat';
    } else {
      // Normal navigation for other pages
      navigate(key);
    }
  };

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
      {/* LOGO */}
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
            height: collapsed ? "32px" : "40px",
            transition: "all 0.3s ease",
            opacity: 0.95,
          }}
        />
      </div>

      {/* MENU */}
      <Menu
        mode="inline"
        selectedKeys={[location.pathname]}
        onClick={(e) => handleMenuClick(e.key)}  // ← CHANGED THIS LINE
        theme="dark"
        style={{
          background: "transparent",
          borderRight: "none",
          flex: 1,
          paddingRight: "6px",
          overflowX: "hidden",
          marginTop: "20px"
        }}
        items={menuItems}
      />
    </div>
  );
}

export default UserSidebar;