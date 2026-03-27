import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { AlertTriangle, CheckCircle, Bell, BellOff } from 'lucide-react-native';

export function NativeAlertDashboard({ alerts, notificationsEnabled, onToggleNotifications }) {
  const [selectedPole, setSelectedPole] = useState('all');

  // 24hr filter
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const recentAlerts = alerts.filter(a => a.timestamp >= twentyFourHoursAgo);

  // Unique poles
  const poleIds = Array.from(new Set(recentAlerts.map(a => a.poleId))).sort();

  // Selected pole
  const filteredAlerts = selectedPole === 'all' 
    ? recentAlerts 
    : recentAlerts.filter(a => a.poleId === selectedPole);

  const activeAlerts = filteredAlerts.filter(a => a.status !== 'SAFE');
  const hasActiveAlerts = activeAlerts.length > 0;

  const getStatusColor = (status) => {
    switch (status) {
      case 'CRITICAL': return '#ef4444'; // Red
      case 'WARNING': return '#f97316'; // Orange
      case 'SAFE': return '#22c55e'; // Green
      default: return '#94a3b8';
    }
  };

  const renderIcon = (status) => {
    if (status === 'SAFE') {
      return <CheckCircle color="#16a34a" size={24} />;
    }
    return <AlertTriangle color="#ea580c" size={24} />;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.title}>Flood Alerts</Text>
        <TouchableOpacity 
          style={[styles.bellButton, notificationsEnabled ? styles.bellButtonActive : styles.bellButtonInactive]} 
          onPress={onToggleNotifications}
        >
          {notificationsEnabled ? <Bell color="#fff" size={16} /> : <BellOff color="#0f172a" size={16} />}
          <Text style={[styles.bellText, notificationsEnabled ? styles.bellTextActive : styles.bellTextInactive]}>
            {notificationsEnabled ? 'On' : 'Off'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Filters & Status */}
      <View style={styles.filterRow}>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={selectedPole}
            onValueChange={(val) => setSelectedPole(val)}
            style={styles.picker}
            dropdownIconColor="#0f172a"
          >
            <Picker.Item label="All Poles" value="all" color="#0f172a" />
            {poleIds.map((pole) => (
              <Picker.Item key={pole} label={pole} value={pole} color="#0f172a" />
            ))}
          </Picker>
        </View>

        <View style={styles.statusContainer}>
          {hasActiveAlerts ? (
            <>
              <AlertTriangle color="#ea580c" size={20} />
              <Text style={styles.activeText}>{activeAlerts.length} Active</Text>
            </>
          ) : (
            <>
              <CheckCircle color="#16a34a" size={20} />
              <Text style={styles.safeText}>All Clear</Text>
            </>
          )}
        </View>
      </View>

      {/* List */}
      <View style={styles.listContainer}>
        {filteredAlerts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No alerts</Text>
          </View>
        ) : (
          filteredAlerts.map(alert => (
            <View key={alert.id} style={[styles.card, alert.status === 'SAFE' && styles.cardOpaque]}>
              <View style={styles.iconBox}>
                {renderIcon(alert.status)}
              </View>
              <View style={styles.cardContent}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{alert.poleId}</Text>
                  <View style={[styles.badge, { backgroundColor: getStatusColor(alert.status) }]}>
                    <Text style={styles.badgeText}>{alert.status === 'SAFE' ? 'CLEAR' : alert.status}</Text>
                  </View>
                </View>
                <Text style={styles.message}>Level: {alert.level} cm</Text>
                <Text style={styles.timestamp}>
                  {alert.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  bellButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  bellButtonActive: {
    backgroundColor: '#0f172a',
  },
  bellButtonInactive: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  bellText: {
    fontSize: 14,
    fontWeight: '600',
  },
  bellTextActive: {
    color: '#fff',
  },
  bellTextInactive: {
    color: '#0f172a',
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
    zIndex: 10,
  },
  pickerContainer: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    width: '100%',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ea580c',
  },
  safeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#16a34a',
  },
  listContainer: {
    paddingBottom: 40,
  },
  emptyCard: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyText: {
    color: '#64748b',
    fontSize: 14,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardOpaque: {
    opacity: 0.6,
  },
  iconBox: {
    marginRight: 12,
    marginTop: 2,
  },
  cardContent: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  message: {
    fontSize: 14,
    color: '#334155',
    marginBottom: 6,
  },
  timestamp: {
    fontSize: 12,
    color: '#94a3b8',
  },
});
