import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const ORANGE = '#FF6B35';

export default function TabLayout() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['bottom']}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: '#fff',
            borderTopColor: '#e8e4df',
            borderTopWidth: 0.5,
            paddingTop: 6,
            paddingBottom: 4,
            height: 54,
          },
          tabBarActiveTintColor: ORANGE,
          tabBarInactiveTintColor: '#aaa',
          tabBarLabelStyle: {
            fontSize: 9,
            fontWeight: '600',
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Today',
            tabBarIcon: () => <Text style={{ fontSize: 16 }}>✅</Text>,
          }}
        />
        <Tabs.Screen
          name="progress"
          options={{
            title: 'Progress',
            tabBarIcon: () => <Text style={{ fontSize: 16 }}>📊</Text>,
          }}
        />
        <Tabs.Screen
          name="coach"
          options={{
            title: 'Team',
            tabBarIcon: () => <Text style={{ fontSize: 16 }}>🎯</Text>,
          }}
        />
        <Tabs.Screen
          name="rewards"
          options={{
            title: 'Rewards',
            tabBarIcon: () => <Text style={{ fontSize: 16 }}>🎁</Text>,
          }}
        />
        <Tabs.Screen
          name="dashboard"
          options={{
            title: 'Board',
            tabBarIcon: () => <Text style={{ fontSize: 16 }}>🏆</Text>,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 16, fontWeight: '800', color }}>⚙</Text>,
          }}
        />
        <Tabs.Screen name="Rewards" options={{ href: null }} />
      </Tabs>
    </SafeAreaView>
  );
}