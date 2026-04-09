import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { AlertTriangle, CheckCircle, Hand, ChevronDown, ChevronUp } from 'lucide-react-native';

export function NativeAlertDashboard({ alerts }) {
  const [selectedPole, setSelectedPole] = useState('all');
  const [expandedPoles, setExpandedPoles] = useState({});

  const togglePole = (id) => {
    setExpandedPoles(prev => ({ ...prev, [id]: !prev[id] }));
  };

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

  const groupedAlerts = Array.from(latestAlertsByPole.keys()).map(poleId => {
    return filteredAlerts.filter(a => a.poleId === poleId);
  });

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
          source={require('./assets/header.png')} 
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
          groupedAlerts.map(poleAlerts => {
            const latestAlert = poleAlerts[0];
            const history = poleAlerts.slice(1);
            const isExpanded = expandedPoles[latestAlert.poleId];
            const hasHistory = history.length > 0;

            return (
              <View key={latestAlert.poleId} style={styles.poleGroup}>
                <TouchableOpacity 
                  activeOpacity={0.7} 
                  onPress={() => togglePole(latestAlert.poleId)}
                  style={[styles.card, styles.cardMain]}
                >
                  <View style={styles.iconBox}>
                    {renderIcon(latestAlert.status)}
                  </View>
                  <View style={styles.cardContent}>
                    <View style={styles.cardHeader}>
                      <Text style={styles.cardTitleCurrent}>{latestAlert.poleId}</Text>
                      <View style={styles.headerRight}>
                        {latestAlert.status !== 'SAFE' && (
                          <View style={[styles.badge, getBadgeStyle(latestAlert.status)]}>
                            <Text style={[styles.badgeText, getBadgeTextStyle(latestAlert.status)]}>{getBadgeLabel(latestAlert.status)}</Text>
                          </View>
                        )}
                        <View style={styles.caretBox}>
                          {isExpanded ? <ChevronUp color="#94a3b8" size={20} /> : <ChevronDown color="#94a3b8" size={20} />}
                        </View>
                      </View>
                    </View>
                    <Text style={styles.messageCurrent}>
                      {latestAlert.status === 'CRITICAL' ? 'Floodwaters present. Road closed for civilian safety.' 
                       : latestAlert.status === 'WARNING' ? 'Heavy Rain in the area. Drive Cautiously.' 
                       : 'Roads clear. Safe to drive.'}
                    </Text>
                    <Text style={styles.timestamp}>
                      {latestAlert.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.historyContainer}>
                    {hasHistory ? history.map(histAlert => (
                      <View key={histAlert.id} style={[styles.card, styles.cardOpaque, styles.historyCard]}>
                        <View style={[styles.iconBox, styles.historyIconBox]}>
                          {renderIcon(histAlert.status)}
                        </View>
                        <View style={styles.cardContent}>
                          <View style={styles.cardHeader}>
                            <Text style={styles.cardTitle}>{histAlert.poleId}</Text>
                            {histAlert.status !== 'SAFE' && (
                              <View style={[styles.badge, getBadgeStyle(histAlert.status), styles.historyBadge]}>
                                <Text style={[styles.badgeText, getBadgeTextStyle(histAlert.status), styles.historyBadgeText]}>{getBadgeLabel(histAlert.status)}</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.message}>
                            {histAlert.status === 'CRITICAL' ? 'Floodwaters present. Road closed for civilian safety.' 
                             : histAlert.status === 'WARNING' ? 'Heavy Rain in the area. Drive Cautiously.' 
                             : 'Roads clear. Safe to drive.'}
                          </Text>
                          <Text style={styles.timestamp}>
                            {histAlert.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                        </View>
                      </View>
                    )) : (
                      <View style={[styles.card, styles.historyCard, { alignItems: 'center', opacity: 0.5 }]}>
                         <Text style={[styles.message, { fontStyle: 'italic', textAlign: 'center' }]}>No older alerts</Text>
                      </View>
                    )}
                  </View>
                )}
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
    paddingLeft: 16,
    paddingTop: 16,
    paddingBottom: 16,
    paddingRight: 0,
    borderRadius: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  logo: {
    height: 48,
    width: 150, 
    transform: [{ translateX: 26 }], // Visually shift right to ignore baked transparent pixels in PNG
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
  poleGroup: {
    marginBottom: 10,
  },
  cardMain: {
    marginBottom: 0,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  caretBox: {
    opacity: 0.6,
  },
  historyContainer: {
    marginTop: 8,
    marginLeft: 24,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderColor: '#f1f5f9',
    gap: 8,
  },
  historyCard: {
    marginBottom: 0,
    backgroundColor: '#fafafa',
    padding: 12,
    borderWidth: 1,
  },
  historyIconBox: {
    transform: [{ scale: 0.75 }],
    marginRight: 8,
  },
  historyBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  historyBadgeText: {
    fontSize: 10,
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
