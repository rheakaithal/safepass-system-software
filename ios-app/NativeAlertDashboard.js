import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { AlertTriangle, CheckCircle, Hand } from 'lucide-react-native';

export function NativeAlertDashboard({ alerts }) {
  const [selectedPole, setSelectedPole] = useState('all');

  // 24hr filter
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const recentAlerts = alerts.filter(a => a.timestamp >= twentyFourHoursAgo);

  // Unique poles
  const activePoleIds = recentAlerts.map(a => a.poleId);
  const predefinedPoles = ['Pole 1', 'Pole 2'];
  const poleIds = Array.from(new Set([...predefinedPoles, ...activePoleIds])).sort();

  // Selected pole
  const filteredAlerts = selectedPole === 'all' 
    ? recentAlerts 
    : recentAlerts.filter(a => a.poleId === selectedPole);

  // Count only the most recent status of each distinct pole
  const latestAlertsByPole = new Map();
  filteredAlerts.forEach(a => {
    if (!latestAlertsByPole.has(a.poleId)) {
      latestAlertsByPole.set(a.poleId, a);
    }
  });

  const activePolesCount = Array.from(latestAlertsByPole.values())
    .filter(a => a.status !== 'SAFE').length;
  const hasActiveAlerts = activePolesCount > 0;
  const hasCritical = Array.from(latestAlertsByPole.values()).some(a => a.status === 'CRITICAL');

  const getDotColor = () => {
    if (activePolesCount === 0) return '#22c55e'; // Green
    if (hasCritical) return '#ef4444'; // Red
    return '#f97316'; // Orange
  };

  const getBadgeStyle = (status) => {
    switch (status) {
      case 'CRITICAL': return { backgroundColor: '#dc2626' }; // Red
      case 'WARNING': return { backgroundColor: '#fb923c' }; // Orange
      case 'SAFE': return { backgroundColor: '#f1f5f9' }; // Light grey
      default: return { backgroundColor: '#e2e8f0' };
    }
  };

  const getBadgeTextStyle = (status) => {
    return status === 'SAFE' ? { color: '#475569' } : { color: '#fff' };
  };

  const getBadgeLabel = (status) => {
    if (status === 'CRITICAL') return 'Critical';
    if (status === 'WARNING') return 'Warning';
    return 'Clear';
  };

  const renderIcon = (status) => {
    if (status === 'SAFE') {
      return <CheckCircle color="#16a34a" size={24} />;
    }
    if (status === 'CRITICAL') {
      return <Hand color="#dc2626" size={24} />;
    }
    return <AlertTriangle color="#ea580c" size={24} />;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.titleWrapper}>
          <Text style={styles.title}>Flood Alerts</Text>
          <View style={styles.pingContainer}>
            <View style={[styles.pingDot, { backgroundColor: getDotColor(), shadowColor: getDotColor() }]} />
            <Text style={styles.pingText}>
              {hasActiveAlerts ? (activePolesCount === 1 ? '1 Active Alert' : `${activePolesCount} Active Alerts`) : 'No Active Alerts'}
            </Text>
          </View>
        </View>

        <Image 
          // ⚠️ IMPORTANT: Update this require path to point to your actual local logo file!
          source={require('./assets/icon.png')} 
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      {/* Filters */}
      <View style={styles.filterRow}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.buttonScrollContent}
        >
          <TouchableOpacity
            style={[styles.poleButton, selectedPole === 'all' && styles.poleButtonActive]}
            onPress={() => setSelectedPole('all')}
          >
            <Text style={[styles.poleButtonText, selectedPole === 'all' && styles.poleButtonTextActive]}>
              All Poles
            </Text>
          </TouchableOpacity>
          {poleIds.map((pole) => (
            <TouchableOpacity
              key={pole}
              style={[styles.poleButton, selectedPole === pole && styles.poleButtonActive]}
              onPress={() => setSelectedPole(pole)}
            >
              <Text style={[styles.poleButtonText, selectedPole === pole && styles.poleButtonTextActive]}>
                {pole}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* List */}
      <View style={styles.listContainer}>
        {filteredAlerts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No alerts</Text>
          </View>
        ) : (
          filteredAlerts.map(alert => {
            const isLatest = alert.id === latestAlertsByPole.get(alert.poleId)?.id;
            return (
            <View key={alert.id} style={[styles.card, !isLatest && styles.cardOpaque]}>
              <View style={styles.iconBox}>
                {renderIcon(alert.status)}
              </View>
              <View style={styles.cardContent}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardTitle, isLatest && styles.cardTitleCurrent]}>{alert.poleId}</Text>
                  {alert.status !== 'SAFE' && (
                    <View style={[styles.badge, getBadgeStyle(alert.status)]}>
                      <Text style={[styles.badgeText, getBadgeTextStyle(alert.status)]}>{getBadgeLabel(alert.status)}</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.message, isLatest && styles.messageCurrent]}>
                  {alert.status === 'CRITICAL' ? 'Floodwaters present. Road closed for civilian safety.' 
                   : alert.status === 'WARNING' ? 'Heavy Rain in the area. Drive Cautiously.' 
                   : 'Roads clear. Safe to drive.'}
                </Text>
                <Text style={styles.timestamp}>
                  {alert.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </View>
            );
          })
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
    marginBottom: 20,
    backgroundColor: '#0f172a',
    padding: 16,
    borderRadius: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  titleWrapper: {
    gap: 4,
  },
  pingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 3,
  },
  pingText: {
    fontSize: 13,
    color: '#cbd5e1',
    fontWeight: '500',
  },
  filterRow: {
    marginBottom: 16,
  },
  buttonScrollContent: {
    paddingRight: 16,
    gap: 8,
    alignItems: 'center',
  },
  poleButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  poleButtonActive: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a',
  },
  poleButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  poleButtonTextActive: {
    color: '#fff',
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
  },
  iconBox: {
    marginRight: 12,
    marginTop: 0,
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
    fontSize: 15,
    fontWeight: '500',
    color: '#334155',
  },
  cardTitleCurrent: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  cardOpaque: {
    opacity: 0.5,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  message: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 6,
  },
  messageCurrent: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  timestamp: {
    fontSize: 12,
    color: '#94a3b8',
  },
});
