import Paho from 'paho-mqtt';
import React, { useEffect, useState } from 'react';
import {
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

// ==========================================
// 1. CẤU HÌNH HỆ THỐNG MQTT TRUNG TÂM
// ==========================================
const MQTT_BROKER = "i1188128.ala.eu-central-1.emqxsl.com";
const MQTT_PORT = 8084; 
const CLIENT_ID = `SmartFarm_Gateway_${Math.random().toString(16).substring(2, 8)}`;
const client = new Paho.Client(MQTT_BROKER, MQTT_PORT, "/mqtt", CLIENT_ID);

// Danh sách cấu hình 20 thông số để render tự động ra màn hình
const SENSOR_CONFIG = [
  { key: 'temp', title: 'Nhiệt độ (Khí)', unit: '°C', color: '#E67E22' },
  { key: 'hum', title: 'Độ ẩm (Khí)', unit: '%', color: '#3498DB' },
  { key: 'co2', title: 'Nồng độ CO2', unit: 'ppm', color: '#9B59B6' },
  { key: 'light', title: 'Cường độ sáng', unit: 'Lux', color: '#F1C40F' },
  { key: 'uv', title: 'Chỉ số UV', unit: 'UV', color: '#8E44AD' },
  { key: 'pressure', title: 'Áp suất khí', unit: 'hPa', color: '#7F8C8D' },
  { key: 'wind_speed', title: 'Tốc độ gió', unit: 'm/s', color: '#16A085' },
  { key: 'rain', title: 'Lượng mưa', unit: 'mm', color: '#2980B9' },
  { key: 'soil_temp', title: 'Nhiệt độ (Đất)', unit: '°C', color: '#D35400' },
  { key: 'soil_hum', title: 'Độ ẩm (Đất)', unit: '%', color: '#27AE60' },
  { key: 'soil_ph', title: 'Độ pH (Đất)', unit: 'pH', color: '#C0392B' },
  { key: 'soil_ec', title: 'Độ dẫn điện EC', unit: 'µS/cm', color: '#D4AC0D' },
  { key: 'soil_n', title: 'Nitơ (N)', unit: 'mg/kg', color: '#2E86C1' },
  { key: 'soil_p', title: 'Photpho (P)', unit: 'mg/kg', color: '#884EA0' },
  { key: 'soil_k', title: 'Kali (K)', unit: 'mg/kg', color: '#CB4335' },
  { key: 'water_temp', title: 'Nhiệt độ nước', unit: '°C', color: '#1ABC9C' },
  { key: 'water_ph', title: 'Độ pH nước', unit: 'pH', color: '#E74C3C' },
  { key: 'water_tds', title: 'Độ TDS', unit: 'ppm', color: '#34495E' },
  { key: 'water_level', title: 'Mực nước bồn', unit: 'cm', color: '#3498DB' },
  { key: 'battery', title: 'Pin trạm Node', unit: '%', color: '#2ECC71' },
];

export default function SmartFarmDashboard() {
  // ==========================================
  // 2. QUẢN LÝ TRẠNG THÁI (STATE MANAGEMENT)
  // ==========================================
  const [activeTab, setActiveTab] = useState<'dashboard' | 'relays'>('dashboard');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  
  // Khởi tạo State chứa 20 giá trị mặc định là "--"
  const initialSensorState: any = {};
  SENSOR_CONFIG.forEach(sensor => {
    initialSensorState[sensor.key] = "--";
  });
  const [sensorData, setSensorData] = useState(initialSensorState);

  // Trạng thái của 10 Rơ-le mở rộng
  const [relayStatus, setRelayStatus] = useState<boolean[]>(Array(10).fill(false));

  // ==========================================
  // 3. LOGIC KẾT NỐI VÀ XỬ LÝ SỰ KIỆN MQTT
  // ==========================================
  useEffect(() => {
    client.connect({
      userName: "quyt",
      password: "1",
      useSSL: true, 
      onSuccess: () => {
        setIsConnected(true);
        console.log("✅ Đã kết nối EMQX Cloud cá nhân!");
        client.subscribe("rangdong/farm/#"); 
      },
      onFailure: (err: any) => {
        setIsConnected(false);
        console.error("❌ Lỗi kết nối MQTT:", err);
      }
    });

    client.onMessageArrived = (message: any) => {
      const topic = message.destinationName;
      const payload = message.payloadString;
      console.log(`📥 DATA: [${topic}] -> ${payload}`);

      // THUẬT TOÁN ĐỌC SENSOR TỰ ĐỘNG THÔNG MINH
      // Nếu Topic bắt đầu bằng "rangdong/farm/sensor/"
      if (topic.startsWith("rangdong/farm/sensor/")) {
        const sensorKey = topic.replace("rangdong/farm/sensor/", "");
        
        // Cập nhật State động (Dynamic State Update)
        setSensorData((prevData: any) => {
          if (sensorKey in prevData) {
            return { ...prevData, [sensorKey]: payload };
          }
          return prevData;
        });
      }

      // Xử lý báo cáo trạng thái Rơ-le (nếu có)
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
        console.log("🔌 Đã ngắt kết nối MQTT.");
      }
    };
  }, []);

  // Hàm gửi lệnh điều khiển 10 Rơ-le
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
      console.log(`📤 LỆNH:  [${message.destinationName}] -> ${command}`);
    } else {
      console.warn("⚠️ Mất kết nối mạng!");
    }
  };

  // ==========================================
  // 4. CÁC THÀNH PHẦN GIAO DIỆN (UI COMPONENTS)
  // ==========================================
  const SensorWidget = ({ title, value, unit, highlightColor }: any) => (
    <View style={styles.widgetHalf}>
      <Text style={styles.widgetTitle} numberOfLines={1}>{title}</Text>
      <View style={styles.valueContainer}>
        <Text style={[styles.sensorValue, { color: highlightColor }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
        <Text style={styles.unitText}>{unit}</Text>
      </View>
    </View>
  );

  const ActuatorWidget = ({ title, isActive, onToggle, activeColor }: any) => (
    <View style={styles.actuatorCardCompact}>
      <Text style={styles.widgetTitleCompact}>{title}</Text>
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

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.dashboardScroll}>
        
        {/* TRANG 1: MA TRẬN 20 SENSOR */}
        {activeTab === 'dashboard' && (
          <>
            <Text style={styles.sectionHeader}>THÔNG SỐ GIÁM SÁT TOÀN DIỆN</Text>
            <View style={styles.rowLayoutGrid}>
              {SENSOR_CONFIG.map((sensor) => (
                <SensorWidget 
                  key={sensor.key}
                  title={sensor.title} 
                  value={sensorData[sensor.key]} 
                  unit={sensor.unit} 
                  highlightColor={sensor.color} 
                />
              ))}
            </View>
          </>
        )}

        {/* TRANG 2: BẢNG 10 RƠ-LE */}
        {activeTab === 'relays' && (
          <>
            <Text style={styles.sectionHeader}>HỆ THỐNG ĐIỀU KHIỂN CHẤP HÀNH</Text>
            <View style={styles.rowLayoutGrid}>
              {relayStatus.map((status, index) => (
                <ActuatorWidget 
                  key={index}
                  title={`Rơ-le ${index + 1}`} 
                  isActive={status} 
                  activeColor="#F39C12"
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
          <Text style={[styles.tabButtonText, activeTab === 'dashboard' && styles.tabButtonTextActive]}>MÔI TRƯỜNG</Text>
          {activeTab === 'dashboard' && <View style={styles.activeIndicator} />}
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabButton} onPress={() => setActiveTab('relays')} activeOpacity={0.7}>
          <Text style={[styles.tabButtonText, activeTab === 'relays' && styles.tabButtonTextActive]}>ĐIỀU KHIỂN</Text>
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
  sectionHeader: { fontSize: 14, fontWeight: '800', color: '#94A3B8', letterSpacing: 1.2, marginBottom: 16, marginTop: 10, textTransform: 'uppercase' },
  
  // Style dạng Grid 2 cột
  rowLayoutGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  
  // Widget của Sensor (Chiếm 48% chiều ngang)
  widgetHalf: { 
    width: '48%', 
    backgroundColor: '#FFFFFF', 
    borderRadius: 20, 
    padding: 18, 
    marginBottom: 16,
    shadowColor: "#64748B", 
    shadowOffset: { width: 0, height: 6 }, 
    shadowOpacity: 0.06, 
    shadowRadius: 12, 
    elevation: 2 
  },
  widgetTitle: { fontSize: 13, fontWeight: '700', color: '#64748B', marginBottom: 8 },
  valueContainer: { flexDirection: 'row', alignItems: 'baseline' },
  sensorValue: { fontSize: 28, fontWeight: '900', letterSpacing: -1, maxWidth: '70%' },
  unitText: { fontSize: 14, color: '#94A3B8', fontWeight: '700', marginLeft: 4 },
  
  // Widget của Relay (Chiếm 48% chiều ngang)
  actuatorCardCompact: { 
    width: '48%', 
    backgroundColor: '#FFFFFF', 
    borderRadius: 20, 
    padding: 16, 
    marginBottom: 16,
    flexDirection: 'column', 
    alignItems: 'flex-start', 
    gap: 12,
    shadowColor: "#64748B", 
    shadowOffset: { width: 0, height: 6 }, 
    shadowOpacity: 0.06, 
    shadowRadius: 12, 
    elevation: 2
  },
  widgetTitleCompact: { fontSize: 14, fontWeight: '700', color: '#475569' },
  
  // Style Tab Bar dưới cùng
  bottomTabBar: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingBottom: Platform.OS === 'ios' ? 20 : 0 },
  tabButton: { flex: 1, paddingVertical: 18, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  tabButtonText: { fontSize: 14, fontWeight: '700', color: '#94A3B8' },
  tabButtonTextActive: { color: '#1E293B', fontWeight: '900' },
  activeIndicator: { position: 'absolute', top: 0, width: '40%', height: 3, backgroundColor: '#3498DB', borderBottomLeftRadius: 3, borderBottomRightRadius: 3 }
});
