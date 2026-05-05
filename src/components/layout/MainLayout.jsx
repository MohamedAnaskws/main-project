import React, { useState } from "react";
import { Layout } from "antd";

import AdminSidebar from "./sidebar/AdminSidebar";
import UserSidebar from "./sidebar/UserSidebar";
import HeaderBar from "./HeaderBar";
import { getUser } from "../../utils/auth";

const { Sider, Content } = Layout;

function MainLayout({ children }) {
  const [collapsed, setCollapsed] = useState(false);

  const user = getUser() ? getUser() : null;
  const roleId = user?.roleid;
  const Sidebar = roleId === 4 ? UserSidebar : AdminSidebar;

  return (
    <Layout className="h-screen overflow-hidden">
      <Sider 
        collapsible 
        collapsed={collapsed} 
        onCollapse={setCollapsed}
        className="h-screen overflow-y-auto"
      >
        <Sidebar collapsed={collapsed} />
      </Sider>

      <Layout className="h-screen overflow-hidden flex flex-col">
        <HeaderBar />
        <Content className="flex-1 overflow-auto m-5 bg-gray-50 rounded-xl">
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}

export default MainLayout;