import { AlertTriangle, CheckCircle, Hand, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { useState } from "react";

export interface FloodAlert {
  id: string;
  poleId: string;
  status: "CRITICAL" | "WARNING" | "SAFE";
  level: number;
  timestamp: Date;
}

interface AlertDashboardProps {
  alerts: FloodAlert[];
  notificationsEnabled: boolean;
  onToggleNotifications: () => void;
}

export function AlertDashboard({ alerts }: AlertDashboardProps) {
  const [selectedPole, setSelectedPole] = useState<string>("all");
  const [expandedPoles, setExpandedPoles] = useState<Record<string, boolean>>({});

  const togglePole = (id: string) => {
    setExpandedPoles(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Filter alerts from last 24 hours
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const recentAlerts = alerts.filter(alert => alert.timestamp >= twentyFourHoursAgo);

  // Get unique poleIds from recent alerts
  const activePoleIds = recentAlerts.map(a => a.poleId);
  const predefinedPoles = ["Pole 1", "Pole 2"];
  const poleIds = Array.from(new Set([...predefinedPoles, ...activePoleIds])).sort();

  // Filter alerts based on selected poleId
  const filteredAlerts = selectedPole === "all" 
    ? recentAlerts 
    : recentAlerts.filter(a => a.poleId === selectedPole);

  // Count only the most recent status of each distinct pole
  const latestAlertsByPole = new Map<string, FloodAlert>();
  filteredAlerts.forEach(a => {
    if (!latestAlertsByPole.has(a.poleId)) {
      latestAlertsByPole.set(a.poleId, a);
    }
  });

  const activePolesCount = Array.from(latestAlertsByPole.values())
    .filter(a => a.status !== "SAFE").length;
  const hasActiveAlerts = activePolesCount > 0;
  const hasCritical = Array.from(latestAlertsByPole.values())
    .some(a => a.status === "CRITICAL");

  const groupedAlerts = Array.from(latestAlertsByPole.keys()).map(poleId => {
    return filteredAlerts.filter(a => a.poleId === poleId);
  });

  const getStatusColor = (status: FloodAlert["status"]) => {
    switch (status) {
      case "CRITICAL":
        return "destructive";
      case "WARNING":
        return "default";
      case "SAFE":
        return "secondary";
    }
  };

  const getStatusIcon = (status: FloodAlert["status"]) => {
    if (status === "SAFE") {
      return <CheckCircle className="h-5 w-5 text-green-600" />;
    }
    if (status === "CRITICAL") {
      return <Hand className="h-5 w-5 text-red-600" />;
    }
    return <AlertTriangle className="h-5 w-5 text-orange-600" />;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-slate-900 pl-5 pr-0 py-3 rounded-xl mb-6 shadow-md overflow-hidden">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">Flood Alerts</h1>
            <div className="flex items-center gap-2 px-2.5 py-1 bg-slate-800/80 rounded-full border border-slate-700">
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${activePolesCount === 0 ? 'bg-green-400' : hasCritical ? 'bg-red-400' : 'bg-orange-400'}`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${activePolesCount === 0 ? 'bg-green-500' : hasCritical ? 'bg-red-500' : 'bg-orange-500'}`}></span>
              </span>
              <span className="text-xs font-medium text-slate-300">
                {hasActiveAlerts ? (activePolesCount === 1 ? '1 Active Alert' : `${activePolesCount} Active Alerts`) : 'No Active Alerts'}
              </span>
            </div>
          </div>
        </div>
        <img 
          src="/header.png"
          alt="SafePass Logo"
          style={{ height: '48px', width: 'auto' }}
          className="object-contain object-right translate-x-6"
        />
      </div>

      {/* Pole Filter */}
      <div className="flex items-center justify-between gap-4">
        <Select value={selectedPole} onValueChange={setSelectedPole}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Poles</SelectItem>
            {poleIds.map((pole) => (
               <SelectItem key={pole} value={pole}>
                 {pole}
               </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Alerts List */}
      <div className="space-y-2">
        {filteredAlerts.length === 0 ? (
          <Card className="shadow-none border-border">
            <CardContent className="py-6 text-center text-muted-foreground text-sm">
              No alerts
            </CardContent>
          </Card>
        ) : (
          groupedAlerts.map((poleAlerts) => {
            const latestAlert = poleAlerts[0];
            const history = poleAlerts.slice(1);
            const isExpanded = expandedPoles[latestAlert.poleId];
            const hasHistory = history.length > 0;

            return (
              <div key={latestAlert.poleId} className="flex flex-col gap-2">
                <Card 
                  className={`border-border cursor-pointer hover:bg-slate-50 transition-colors shadow-sm`}
                  onClick={() => togglePole(latestAlert.poleId)}
                >
                  <CardContent className="py-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0">{getStatusIcon(latestAlert.status)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-bold text-lg text-slate-800">{latestAlert.poleId}</h3>
                          <div className="flex items-center gap-3">
                            {latestAlert.status !== 'SAFE' && (
                              <Badge variant={getStatusColor(latestAlert.status)} className="text-xs rounded-lg px-2.5 py-0.5">
                                {latestAlert.status === "CRITICAL" ? "Critical" : "Warning"}
                              </Badge>
                            )}
                            <div className="opacity-40 text-slate-500">
                              {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                            </div>
                          </div>
                        </div>
                        <p className="mt-1 text-base font-bold text-slate-700">
                          {latestAlert.status === "CRITICAL" ? "Floodwaters present. Road closed for civilian safety." 
                           : latestAlert.status === "WARNING" ? "Heavy Rain in the area. Drive Cautiously." 
                           : "Roads clear. Safe to drive."}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          {latestAlert.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {isExpanded && (
                  <div className="pl-4 space-y-2 border-l-2 border-slate-100 ml-6 mb-2">
                    {hasHistory ? history.map(histAlert => (
                      <Card key={histAlert.id} className="shadow-none border-border opacity-70 bg-slate-50/50">
                        <CardContent className="py-3">
                          <div className="flex items-start gap-3">
                            <div className="mt-0 scale-75 origin-top">{getStatusIcon(histAlert.status)}</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <h3 className="font-semibold text-sm text-slate-800">{histAlert.poleId}</h3>
                                {histAlert.status !== 'SAFE' && (
                                  <Badge variant={getStatusColor(histAlert.status)} className="text-[10px] rounded-lg px-2 py-0.5 leading-none">
                                    {histAlert.status === "CRITICAL" ? "Critical" : "Warning"}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-slate-600 mt-0.5 leading-tight">
                                {histAlert.status === "CRITICAL" ? "Floodwaters present. Road closed for civilian safety." 
                                 : histAlert.status === "WARNING" ? "Heavy Rain in the area. Drive Cautiously." 
                                 : "Roads clear. Safe to drive."}
                              </p>
                              <p className="text-[11px] text-slate-400 mt-1">
                                {histAlert.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )) : (
                      <Card className="shadow-none border-border opacity-50 bg-slate-50/50">
                        <CardContent className="py-4 flex justify-center items-center">
                          <p className="text-sm text-slate-500 italic">No older alerts</p>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}