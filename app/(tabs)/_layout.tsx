import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0d0d14',
          borderTopColor: 'rgba(255,255,255,0.06)',
        },
        tabBarActiveTintColor: '#00e5ff',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.3)',
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ color }) => (
            <TabIcon emoji="✅" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Progress',
          tabBarIcon: ({ color }) => (
            <TabIcon emoji="📊" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

function TabIcon({ emoji, color }: { emoji: string; color: string }) {
  const { Text } = require('react-native');
  return <Text style={{ fontSize: 20, opacity: color === '#00e5ff' ? 1 : 0.4 }}>{emoji}</Text>;
}