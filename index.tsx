import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, Switch, SafeAreaView, 
  StatusBar, ScrollView, Platform, TouchableOpacity 
} from 'react-native';
import Paho from 'paho-mqtt';

// ==========================================
// 1. CẤU HÌNH HỆ THỐNG MQTT TRUNG TÂM
// ==========================================
const MQTT_BROKER = "broker.emqx.io";
const MQTT_PORT = 8083; 
const CLIENT_ID = `SmartFarm_Gateway_${Math.random().toString(16).substring(2, 8)}`;
const client = new Paho.Client(MQTT_BROKER, MQTT_PORT, "/mqtt", CLIENT_ID);

export default function SmartFarmDashboard() {
  // ==========================================
  // 2. QUẢN LÝ TRẠNG THÁI (STATE MANAGEMENT)
  // ==========================================
  
  const [activeTab, setActiveTab] = useState<'dashboard' | 'relays'>('dashboard');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  
  const [sensorData, setSensorData] = useState({
    co2: "0",
    temp: "--",
    hum: "--"
  });

  const [deviceStatus, setDeviceStatus] = useState({
    pump: false,
    fan: false
  });

  const [relayStatus, setRelayStatus] = useState<boolean[]>(Array(10).fill(false));

  // ==========================================
  // 3. LOGIC KẾT NỐI VÀ XỬ LÝ SỰ KIỆN MQTT
  // ==========================================
  useEffect(() => {
    client.connect({
      onSuccess: () => {
        setIsConnected(true);
        console.log("✅ HỆ THỐNG: Đã kết nối tới MQTT Broker thành công!");
        client.subscribe("rangdong/farm/#"); 
      },
      onFailure: (err: any) => {
        setIsConnected(false);
        console.error("❌ HỆ THỐNG: Lỗi kết nối MQTT:", err);
      }
    });

    client.onMessageArrived = (message: any) => {
      const topic = message.destinationName;
      const payload = message.payloadString;

      // In ra Terminal mỗi khi có dữ liệu chạy về App
      console.log(`📥 NHẬN DATA: [${topic}] -> ${payload}`);

      setSensorData(prevData => {
        if (topic === "rangdong/farm/sensor/co2") return { ...prevData, co2: payload };
        if (topic === "rangdong/farm/sensor/temp") return { ...prevData, temp: payload };
        if (topic === "rangdong/farm/sensor/hum") return { ...prevData, hum: payload };
        return prevData;
      });

      if (topic.startsWith("rangdong/farm/control/relay")) {
        const relayNum = parseInt(topic.replace("rangdong/farm/control/relay", ""));
        if (!isNaN(relayNum) && relayNum >= 1 && relayNum <= 10) {
          setRelayStatus(prev => {
            const updated = [...prev];
            updated[relayNum - 1] = (payload === "ON");
            return updated;
          });
        }
      }
    };

    return () => {
      if (client.isConnected()) {
        client.disconnect();
        console.log("🔌 HỆ THỐNG: Đã ngắt kết nối MQTT.");
      }
    };
  }, []);

  // Hàm điều khiển Bơm/Quạt
  const publishCommand = (device: 'pump' | 'fan', state: boolean) => {
    setDeviceStatus(prev => ({ ...prev, [device]: state }));
    if (client.isConnected()) {
      const command = state ? "ON" : "OFF";
      const message = new Paho.Message(command);
      message.destinationName = `rangdong/farm/control/${device}`;
      client.send(message);
      
      // In ra Terminal khi gạt công tắc Bơm/Quạt
      console.log(`📤 GỬI LỆNH:  [${message.destinationName}] -> ${command}`);
    } else {
      console.warn("⚠️ CẢNH BÁO: Không thể gửi lệnh. App đang mất kết nối mạng!");
    }
  };

  // Hàm điều khiển 10 Rơ-le
  const publishRelayCommand = (index: number, state: boolean) => {
    setRelayStatus(prev => {
      const updated = [...prev];
      updated[index] = state;
      return updated;
    });
    if (client.isConnected()) {
      const command = state ? "ON" : "OFF";
      const message = new Paho.Message(command);
      message.destinationName = `rangdong/farm/control/relay${index + 1}`;
      client.send(message);
      
      // In ra Terminal khi gạt một trong 10 Rơ-le
      console.log(`📤 GỬI LỆNH:  [${message.destinationName}] -> ${command}`);
    } else {
      console.warn("⚠️ CẢNH BÁO: Không thể gửi lệnh rơ-le. App đang mất kết nối mạng!");
    }
  };

  // ==========================================
  // 4. CÁC THÀNH PHẦN GIAO DIỆN (UI COMPONENTS)
  // ==========================================
  const SensorWidget = ({ title, value, unit, highlightColor, isFullWidth = false }: any) => (
    <View style={[styles.widgetCard, isFullWidth ? styles.widgetFull : styles.widgetHalf]}>
      <Text style={styles.widgetTitle}>{title}</Text>
      <View style={styles.valueContainer}>
        <Text style={[styles.sensorValue, { color: highlightColor }]}>{value}</Text>
        <Text style={styles.unitText}>{unit}</Text>
      </View>
    </View>
  );

  const ActuatorWidget = ({ title, isActive, onToggle, activeColor, isCompact = false }: any) => (
    <View style={[styles.actuatorCard, isCompact && styles.actuatorCardCompact]}>
      <View style={styles.actuatorInfo}>
        <Text style={[styles.widgetTitle, isCompact && styles.widgetTitleCompact]}>{title}</Text>
        {!isCompact && (
          <Text style={[styles.statusText, { color: isActive ? activeColor : '#95a5a6' }]}>
            {isActive ? "ĐANG HOẠT ĐỘNG" : "ĐANG DỪNG"}
          </Text>
        )}
      </View>
      <Switch
        trackColor={{ false: "#dcdde1", true: activeColor }}
        thumbColor={"#ffffff"}
        ios_backgroundColor="#dcdde1"
        onValueChange={onToggle}
        value={isActive}
        style={Platform.OS === 'ios' ? { transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }] } : { transform: [{ scaleX: 1.1 }, { scaleY: 1.1 }] }}
      />
    </View>
  );

  // ==========================================
  // 5. GIAO DIỆN MÀN HÌNH CHÍNH
  // ==========================================
  return (
    <SafeAreaView style={styles.mainContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#F4F7FB" />
      
      {/* HEADER */}
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

      {/* NỘI DUNG CHÍNH */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.dashboardScroll}>
        
        {/* TRANG 1: TỔNG QUAN */}
        {activeTab === 'dashboard' && (
          <>
            <Text style={styles.sectionHeader}>THÔNG SỐ MÔI TRƯỜNG</Text>
            <View style={styles.rowLayout}>
              <SensorWidget title="Nhiệt độ (Không khí)" value={sensorData.temp} unit="°C" highlightColor="#E67E22" />
              <SensorWidget title="Độ ẩm (Không khí)" value={sensorData.hum} unit="%" highlightColor="#3498DB" />
            </View>
            <SensorWidget title="Nồng độ CO2" value={sensorData.co2} unit="ppm" highlightColor="#9B59B6" isFullWidth={true} />

            <Text style={styles.sectionHeader}>THIẾT BỊ CHÍNH</Text>
            <ActuatorWidget title="Máy Bơm" isActive={deviceStatus.pump} activeColor="#3498DB" onToggle={(val: boolean) => publishCommand('pump', val)} />
            <ActuatorWidget title="Quạt" isActive={deviceStatus.fan} activeColor="#1ABC9C" onToggle={(val: boolean) => publishCommand('fan', val)} />
          </>
        )}

        {/* TRANG 2: BẢNG 10 RƠ-LE */}
        {activeTab === 'relays' && (
          <>
            <Text style={styles.sectionHeader}>HỆ THỐNG RƠ-LE MỞ RỘNG</Text>
            <View style={styles.rowLayoutGrid}>
              {relayStatus.map((status, index) => (
                <ActuatorWidget 
                  key={index}
                  title={`Rơ-le ${index + 1}`} 
                  isActive={status} 
                  activeColor="#F39C12"
                  isCompact={true}
                  onToggle={(val: boolean) => publishRelayCommand(index, val)} 
                />
              ))}
            </View>
          </>
        )}

      </ScrollView>

      {/* BOTTOM NAVIGATION BAR */}
      <View style={styles.bottomTabBar}>
        <TouchableOpacity style={styles.tabButton} onPress={() => setActiveTab('dashboard')} activeOpacity={0.7}>
          <Text style={[styles.tabButtonText, activeTab === 'dashboard' && styles.tabButtonTextActive]}>TỔNG QUAN</Text>
          {activeTab === 'dashboard' && <View style={styles.activeIndicator} />}
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabButton} onPress={() => setActiveTab('relays')} activeOpacity={0.7}>
          <Text style={[styles.tabButtonText, activeTab === 'relays' && styles.tabButtonTextActive]}>10 RƠ-LE</Text>
          {activeTab === 'relays' && <View style={styles.activeIndicator} />}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ==========================================
// 6. HỆ THỐNG KIỂU DÁNG (STYLESHEET)
// ==========================================
const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#F4F7FB' },
  headerArea: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, paddingTop: Platform.OS === 'android' ? 40 : 20, paddingBottom: 20, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  appTitle: { fontSize: 24, fontWeight: '900', color: '#1E293B', letterSpacing: 0.5 },
  appSubtitle: { fontSize: 13, color: '#64748B', marginTop: 4, fontWeight: '500' },
  networkBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  pulseDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  networkText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  dashboardScroll: { padding: 22, paddingBottom: 20 },
  sectionHeader: { fontSize: 14, fontWeight: '800', color: '#94A3B8', letterSpacing: 1.2, marginBottom: 16, marginTop: 10 },
  rowLayout: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  rowLayoutGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  widgetCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, shadowColor: "#64748B", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 3 },
  widgetHalf: { width: '48%' },
  widgetFull: { width: '100%', marginBottom: 28 },
  widgetTitle: { fontSize: 15, fontWeight: '700', color: '#475569', marginBottom: 10 },
  widgetTitleCompact: { marginBottom: 0, fontSize: 14 },
  valueContainer: { flexDirection: 'row', alignItems: 'baseline' },
  sensorValue: { fontSize: 36, fontWeight: '900', letterSpacing: -1 },
  unitText: { fontSize: 16, color: '#94A3B8', fontWeight: '700', marginLeft: 6 },
  actuatorCard: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 20, padding: 22, marginBottom: 16, alignItems: 'center', justifyContent: 'space-between', shadowColor: "#64748B", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 3 },
  actuatorCardCompact: { width: '48%', padding: 16, flexDirection: 'column', alignItems: 'flex-start', gap: 12 },
  actuatorInfo: { flex: 1 },
  statusText: { fontSize: 12, fontWeight: '800', marginTop: 6, letterSpacing: 0.5 },
  bottomTabBar: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingBottom: Platform.OS === 'ios' ? 20 : 0 },
  tabButton: { flex: 1, paddingVertical: 18, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  tabButtonText: { fontSize: 14, fontWeight: '700', color: '#94A3B8' },
  tabButtonTextActive: { color: '#1E293B', fontWeight: '900' },
  activeIndicator: { position: 'absolute', top: 0, width: '40%', height: 3, backgroundColor: '#3498DB', borderBottomLeftRadius: 3, borderBottomRightRadius: 3 }
});
