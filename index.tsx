import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, Switch, SafeAreaView, 
  StatusBar, ScrollView, Platform, TouchableOpacity 
} from 'react-native';
import Paho from 'paho-mqtt';

// ==========================================
// 1. CẤU HÌNH HỆ THỐNG MQTT TRUNG TÂM
// ==========================================
const MQTT_BROKER = "i1188128.ala.eu-central-1.emqxsl.com";
const MQTT_PORT = 8084; 
const CLIENT_ID = `SmartFarm_Gateway_${Math.random().toString(16).substring(2, 8)}`;
const client = new Paho.Client(MQTT_BROKER, MQTT_PORT, "/mqtt", CLIENT_ID);

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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'relays' | 'history'>('dashboard');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  
  // State Thông số hiện tại
  const initialSensorState: any = {};
  SENSOR_CONFIG.forEach(s => { initialSensorState[s.key] = "--"; });
  const [sensorData, setSensorData] = useState(initialSensorState);

  // State Lịch sử (Mỗi key chứa 1 mảng các số)
  const [historyData, setHistoryData] = useState<Record<string, number[]>>({});
  
  // State chọn thông số nào để xem biểu đồ
  const [selectedChartSensor, setSelectedChartSensor] = useState<string>('temp');

  // State Rơ-le
  const [relayStatus, setRelayStatus] = useState<boolean[]>(Array(10).fill(false));

  // ==========================================
  // 3. LOGIC KẾT NỐI VÀ MQTT
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

      if (topic.startsWith("rangdong/farm/sensor/")) {
        const sensorKey = topic.replace("rangdong/farm/sensor/", "");
        
        // 1. Cập nhật số liệu hiển thị tức thời
        setSensorData((prevData: any) => {
          if (sensorKey in prevData) return { ...prevData, [sensorKey]: payload };
          return prevData;
        });

        // 2. Lọc và đẩy vào Lịch sử (Chỉ lấy số liệu hợp lệ)
        const numValue = parseFloat(payload);
        if (!isNaN(numValue)) {
          setHistoryData((prevHistory) => {
            const currentArr = prevHistory[sensorKey] || [];
            // Giữ lại 10 giá trị gần nhất để đồ thị không bị tràn màn hình
            const newArr = [...currentArr, numValue].slice(-10);
            return { ...prevHistory, [sensorKey]: newArr };
          });
        }
      }

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
      if (client.isConnected()) client.disconnect();
    };
  }, []);

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
    }
  };

  // ==========================================
  // 4. THÀNH PHẦN GIAO DIỆN CON
  // ==========================================
  const SensorWidget = ({ title, value, unit, highlightColor }: any) => (
    <View style={styles.widgetHalf}>
      <Text style={styles.widgetTitle} numberOfLines={1}>{title}</Text>
      <View style={styles.valueContainer}>
        <Text style={[styles.sensorValue, { color: highlightColor }]} numberOfLines={1}>{value}</Text>
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
        onValueChange={onToggle}
        value={isActive}
        style={{ transform: [{ scaleX: 1.1 }, { scaleY: 1.1 }] }}
      />
    </View>
  );

  // Khối vẽ đồ thị Cột (Custom Bar Chart)
  const CustomBarChart = ({ data, color, unit }: { data: number[], color: string, unit: string }) => {
    if (!data || data.length === 0) {
      return (
        <View style={styles.emptyChart}>
          <Text style={styles.emptyChartText}>Đang chờ dữ liệu từ thiết bị...</Text>
        </View>
      );
    }

    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = (max - min) === 0 ? 1 : (max - min); // Tránh chia cho 0

    return (
      <View style={styles.chartContainer}>
        {data.map((val, idx) => {
          // Tính toán chiều cao cột (Tối thiểu 15%, tối đa 100%)
          const heightPct = Math.max(15, ((val - min) / range) * 100);
          return (
            <View key={idx} style={styles.chartBarWrapper}>
              <Text style={styles.chartValueLabel}>{val}</Text>
              <View style={[styles.chartBar, { height: `${heightPct}%`, backgroundColor: color }]} />
            </View>
          );
        })}
      </View>
    );
  };

  // Lấy cấu hình của cảm biến đang được chọn để vẽ chart
  const currentChartConfig = SENSOR_CONFIG.find(s => s.key === selectedChartSensor);

  // ==========================================
  // 5. GIAO DIỆN CHÍNH
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
        
        {/* TRANG 1: 20 SENSOR */}
        {activeTab === 'dashboard' && (
          <>
            <Text style={styles.sectionHeader}>THÔNG SỐ GIÁM SÁT TOÀN DIỆN</Text>
            <View style={styles.rowLayoutGrid}>
              {SENSOR_CONFIG.map((sensor) => (
                <SensorWidget 
                  key={sensor.key} title={sensor.title} 
                  value={sensorData[sensor.key]} unit={sensor.unit} 
                  highlightColor={sensor.color} 
                />
              ))}
            </View>
          </>
        )}

        {/* TRANG 2: 10 RƠ-LE */}
        {activeTab === 'relays' && (
          <>
            <Text style={styles.sectionHeader}>HỆ THỐNG ĐIỀU KHIỂN CHẤP HÀNH</Text>
            <View style={styles.rowLayoutGrid}>
              {relayStatus.map((status, index) => (
                <ActuatorWidget 
                  key={index} title={`Rơ-le ${index + 1}`} 
                  isActive={status} activeColor="#F39C12"
                  onToggle={(val: boolean) => publishRelayCommand(index, val)} 
                />
              ))}
            </View>
          </>
        )}

        {/* TRANG 3: BIỂU ĐỒ LỊCH SỬ */}
        {activeTab === 'history' && currentChartConfig && (
          <>
            <Text style={styles.sectionHeader}>CHỌN THÔNG SỐ CẦN THEO DÕI</Text>
            
            {/* Thanh cuộn ngang chọn Sensor */}
            <View style={{ height: 60, marginBottom: 20 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {SENSOR_CONFIG.map((sensor) => (
                  <TouchableOpacity 
                    key={sensor.key}
                    style={[styles.chipButton, selectedChartSensor === sensor.key && { backgroundColor: sensor.color, borderColor: sensor.color }]}
                    onPress={() => setSelectedChartSensor(sensor.key)}
                  >
                    <Text style={[styles.chipText, selectedChartSensor === sensor.key && styles.chipTextActive]}>
                      {sensor.title}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Bảng Vẽ Biểu Đồ */}
            <View style={styles.chartCard}>
              <View style={styles.chartHeader}>
                <Text style={styles.chartTitle}>Biểu đồ {currentChartConfig.title.toLowerCase()}</Text>
                <Text style={styles.chartUnit}>Đơn vị: {currentChartConfig.unit}</Text>
              </View>
              
              <CustomBarChart 
                data={historyData[selectedChartSensor] || []} 
                color={currentChartConfig.color}
                unit={currentChartConfig.unit}
              />
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

        <TouchableOpacity style={styles.tabButton} onPress={() => setActiveTab('history')} activeOpacity={0.7}>
          <Text style={[styles.tabButtonText, activeTab === 'history' && styles.tabButtonTextActive]}>LỊCH SỬ</Text>
          {activeTab === 'history' && <View style={styles.activeIndicator} />}
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
  
  rowLayoutGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  
  widgetHalf: { width: '48%', backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18, marginBottom: 16, shadowColor: "#64748B", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 2 },
  widgetTitle: { fontSize: 13, fontWeight: '700', color: '#64748B', marginBottom: 8 },
  valueContainer: { flexDirection: 'row', alignItems: 'baseline' },
  sensorValue: { fontSize: 26, fontWeight: '900', letterSpacing: -1, maxWidth: '70%' },
  unitText: { fontSize: 14, color: '#94A3B8', fontWeight: '700', marginLeft: 4 },
  
  actuatorCardCompact: { width: '48%', backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, marginBottom: 16, flexDirection: 'column', alignItems: 'flex-start', gap: 12, shadowColor: "#64748B", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 2 },
  widgetTitleCompact: { fontSize: 14, fontWeight: '700', color: '#475569' },
  
  // Style cho Tab Lịch sử & Biểu đồ
  chipButton: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#FFFFFF', borderRadius: 20, marginRight: 10, borderWidth: 1, borderColor: '#E2E8F0', justifyContent: 'center' },
  chipText: { fontSize: 13, fontWeight: '700', color: '#64748B' },
  chipTextActive: { color: '#FFFFFF' },
  
  chartCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, shadowColor: "#64748B", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 2 },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  chartTitle: { fontSize: 16, fontWeight: '800', color: '#1E293B' },
  chartUnit: { fontSize: 13, fontWeight: '600', color: '#94A3B8' },
  
  emptyChart: { height: 200, justifyContent: 'center', alignItems: 'center' },
  emptyChartText: { color: '#94A3B8', fontWeight: '600', fontStyle: 'italic' },
  
  chartContainer: { height: 220, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  chartBarWrapper: { alignItems: 'center', width: '8%', height: '100%', justifyContent: 'flex-end' },
  chartValueLabel: { fontSize: 10, color: '#64748B', fontWeight: '700', marginBottom: 6 },
  chartBar: { width: '100%', borderTopLeftRadius: 6, borderTopRightRadius: 6 },

  // Bottom Tab
  bottomTabBar: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingBottom: Platform.OS === 'ios' ? 20 : 0 },
  tabButton: { flex: 1, paddingVertical: 18, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  tabButtonText: { fontSize: 13, fontWeight: '700', color: '#94A3B8' },
  tabButtonTextActive: { color: '#1E293B', fontWeight: '900' },
  activeIndicator: { position: 'absolute', top: 0, width: '40%', height: 3, backgroundColor: '#3498DB', borderBottomLeftRadius: 3, borderBottomRightRadius: 3 }
});
