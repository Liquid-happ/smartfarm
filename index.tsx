import Paho from 'paho-mqtt';
import React, { useEffect, useState } from 'react';
import {
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text, View
} from 'react-native';

// ==========================================
// 1. CẤU HÌNH HỆ THỐNG MQTT TRUNG TÂM
// ==========================================
const MQTT_BROKER = "broker.emqx.io";
const MQTT_PORT = 8083; 
// Tạo Client ID ngẫu nhiên để tránh xung đột khi nhiều người cùng mở App
const CLIENT_ID = `SmartFarm_Gateway_${Math.random().toString(16).substring(2, 8)}`;
const client = new Paho.Client(MQTT_BROKER, MQTT_PORT, "/mqtt", CLIENT_ID);

export default function SmartFarmDashboard() {
  // ==========================================
  // 2. QUẢN LÝ TRẠNG THÁI (STATE MANAGEMENT)
  // ==========================================
  
  // Trạng thái kết nối mạng
  const [isConnected, setIsConnected] = useState<boolean>(false);
  
  // Dữ liệu từ các node Cảm biến (Sensor Nodes)
  const [sensorData, setSensorData] = useState({
    co2: "0",
    temp: "--",
    hum: "--"
  });

  // Trạng thái của các thiết bị chấp hành (Actuator Nodes)
  const [deviceStatus, setDeviceStatus] = useState({
    pump: false,
    fan: false
  });

  // ==========================================
  // 3. LOGIC KẾT NỐI VÀ XỬ LÝ SỰ KIỆN MQTT
  // ==========================================
  useEffect(() => {
    // Khởi tạo kết nối
    client.connect({
      onSuccess: () => {
        setIsConnected(true);
        console.log("✅ Đã kết nối tới MQTT Broker!");
        // Đăng ký nhận mọi dữ liệu từ nhánh sensor
        client.subscribe("rangdong/farm/sensor/#"); 
      },
      onFailure: (err: any) => {
        setIsConnected(false);
        console.error("❌ Lỗi kết nối MQTT:", err);
      }
    });

    // Hàm Callback: Kích hoạt mỗi khi có gói tin gửi đến
    client.onMessageArrived = (message: any) => {
      const topic = message.destinationName;
      const payload = message.payloadString;

      // Cập nhật State dựa trên Topic nhận được
      setSensorData(prevData => {
        if (topic === "rangdong/farm/sensor/co2") return { ...prevData, co2: payload };
        if (topic === "rangdong/farm/sensor/temp") return { ...prevData, temp: payload };
        if (topic === "rangdong/farm/sensor/hum") return { ...prevData, hum: payload };
        return prevData;
      });
    };

    // Dọn dẹp kết nối khi người dùng đóng App
    return () => {
      if (client.isConnected()) {
        client.disconnect();
        console.log("🔌 Đã ngắt kết nối MQTT.");
      }
    };
  }, []);

  // Hàm gửi lệnh (Publish) xuống Vi điều khiển (ESP32/STM32)
  const publishCommand = (device: 'pump' | 'fan', state: boolean) => {
    // Cập nhật giao diện App ngay lập tức cho mượt
    setDeviceStatus(prev => ({ ...prev, [device]: state }));

    if (client.isConnected()) {
      const command = state ? "ON" : "OFF";
      const message = new Paho.Message(command);
      message.destinationName = `rangdong/farm/control/${device}`;
      client.send(message);
      console.log(`📡 Đã gửi lệnh: [${message.destinationName}] -> ${command}`);
    } else {
      console.warn("⚠️ Không thể gửi lệnh. App đang mất kết nối!");
    }
  };

  // ==========================================
  // 4. CÁC THÀNH PHẦN GIAO DIỆN (UI COMPONENTS)
  // ==========================================

  // Khối hiển thị thông số cảm biến (Tái sử dụng)
  const SensorWidget = ({ title, value, unit, highlightColor, isFullWidth = false }: any) => (
    <View style={[styles.widgetCard, isFullWidth ? styles.widgetFull : styles.widgetHalf]}>
      <Text style={styles.widgetTitle}>{title}</Text>
      <View style={styles.valueContainer}>
        <Text style={[styles.sensorValue, { color: highlightColor }]}>{value}</Text>
        <Text style={styles.unitText}>{unit}</Text>
      </View>
    </View>
  );

  // Khối công tắc điều khiển thiết bị (Tái sử dụng)
  const ActuatorWidget = ({ title, isActive, onToggle, activeColor }: any) => (
    <View style={styles.actuatorCard}>
      <View style={styles.actuatorInfo}>
        <Text style={styles.widgetTitle}>{title}</Text>
        <Text style={[styles.statusText, { color: isActive ? activeColor : '#95a5a6' }]}>
          {isActive ? "ĐANG HOẠT ĐỘNG" : "ĐANG DỪNG"}
        </Text>
      </View>
      <Switch
        trackColor={{ false: "#dcdde1", true: activeColor }}
        thumbColor={"#ffffff"}
        ios_backgroundColor="#dcdde1"
        onValueChange={onToggle}
        value={isActive}
        style={Platform.OS === 'ios' ? { transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }] } : { transform: [{ scaleX: 1.3 }, { scaleY: 1.3 }] }}
      />
    </View>
  );

  // ==========================================
  // 5. GIAO DIỆN MÀN HÌNH CHÍNH (MAIN RENDER)
  // ==========================================
  return (
    <SafeAreaView style={styles.mainContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#F4F7FB" />
      
      {/* KHU VỰC HEADER: Tiêu đề & Trạng thái mạng */}
      <View style={styles.headerArea}>
        <View>
          <Text style={styles.appTitle}>SMART FARM</Text>
          <Text style={styles.appSubtitle}>Hệ thống giám sát trung tâm</Text>
        </View>
        <View style={[styles.networkBadge, { backgroundColor: isConnected ? '#E8F8F5' : '#FDEDEC' }]}>
          <View style={[styles.pulseDot, { backgroundColor: isConnected ? '#2ECC71' : '#E74C3C' }]} />
          <Text style={[styles.networkText, { color: isConnected ? '#27AE60' : '#C0392B' }]}>
            {isConnected ? 'ONLINE' : 'OFFLINE'}
          </Text>
        </View>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.dashboardScroll}
      >
        
        {/* SECTION 1: GIÁM SÁT MÔI TRƯỜNG */}
        <Text style={styles.sectionHeader}>THÔNG SỐ MÔI TRƯỜNG</Text>
        
        <View style={styles.rowLayout}>
          <SensorWidget 
            title="Nhiệt độ (Không khí)" 
            value={sensorData.temp} 
            unit="°C" 
            highlightColor="#E67E22" 
          />
          <SensorWidget 
            title="Độ ẩm (Không khí)" 
            value={sensorData.hum} 
            unit="%" 
            highlightColor="#3498DB" 
          />
        </View>
        
        <SensorWidget 
          title="Nồng độ CO2" 
          value={sensorData.co2} 
          unit="ppm" 
          highlightColor="#9B59B6" 
          isFullWidth={true} 
        />

        {/* SECTION 2: ĐIỀU KHIỂN THIẾT BỊ */}
        <Text style={styles.sectionHeader}>BẢNG ĐIỀU KHIỂN RƠ-LE</Text>
        
        <ActuatorWidget 
          title="Máy Bơm" 
          isActive={deviceStatus.pump} 
          activeColor="#3498DB"
          onToggle={(val: boolean) => publishCommand('pump', val)} 
        />
        
        <ActuatorWidget 
          title="Quạt" 
          isActive={deviceStatus.fan} 
          activeColor="#1ABC9C"
          onToggle={(val: boolean) => publishCommand('fan', val)} 
        />

      </ScrollView>
    </SafeAreaView>
  );
}

// ==========================================
// 6. HỆ THỐNG KIỂU DÁNG (STYLESHEET)
// ==========================================
const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#F4F7FB',
  },
  headerArea: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingTop: Platform.OS === 'android' ? 40 : 20,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  appTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#1E293B',
    letterSpacing: 0.5,
  },
  appSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    fontWeight: '500',
  },
  networkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  networkText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  dashboardScroll: {
    padding: 22,
    paddingBottom: 60,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1.2,
    marginBottom: 16,
    marginTop: 10,
  },
  rowLayout: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  widgetCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    // Hiệu ứng đổ bóng mềm mại (Soft Shadow)
    shadowColor: "#64748B",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3, 
  },
  widgetHalf: {
    width: '48%', 
  },
  widgetFull: {
    width: '100%',
    marginBottom: 28,
  },
  widgetTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 10,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  sensorValue: {
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1,
  },
  unitText: {
    fontSize: 16,
    color: '#94A3B8',
    fontWeight: '700',
    marginLeft: 6,
  },
  actuatorCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: "#64748B",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  actuatorInfo: {
    flex: 1,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '800',
    marginTop: 6,
    letterSpacing: 0.5,
  }
});