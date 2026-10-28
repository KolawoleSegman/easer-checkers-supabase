import React, { useEffect } from 'react';
import { ActivityIndicator, View, Text } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from './src/store/auth';
import AuthScreen from './src/screens/AuthScreen';
import HomeScreen from './src/screens/HomeScreen';
import GameScreen from './src/screens/GameScreen';
import LeaderboardScreen from './src/screens/LeaderboardScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import FriendsScreen from './src/screens/FriendsScreen';
import TournamentsScreen from './src/screens/TournamentsScreen';
import TournamentDetailScreen from './src/screens/TournamentDetailScreen';
import { C } from './src/components/Screen';
import type { RootStackParamList } from './src/navigation/types';
import { disconnectSocket } from './src/api/socket';
import { unloadSounds } from './src/lib/sounds';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator();

function tabIcon(name: string, focused: boolean) {
  const color = focused ? C.green : C.muted;
  const map: Record<string, string> = {
    Home: '⌂',
    History: '☰',
    Friends: '♟',
    Tournaments: '🏆',
    Leaderboard: '♜',
    Profile: '◉',
  };
  return <Text style={{ fontSize: 16, color }}>{map[name] || '•'}</Text>;
}

function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: C.panel,
          borderTopColor: '#304239',
          height: 62,
          paddingTop: 7,
          paddingBottom: 7,
        },
        tabBarActiveTintColor: C.green,
        tabBarInactiveTintColor: C.muted,
        tabBarLabelStyle: { fontSize: 9, fontWeight: '700' },
        tabBarIcon: ({ focused }) => tabIcon(route.name, focused),
      })}
    >
      <Tabs.Screen name="Home" component={HomeScreen as React.ComponentType<any>} />
      <Tabs.Screen name="History" component={HistoryScreen as React.ComponentType<any>} />
      <Tabs.Screen name="Friends" component={FriendsScreen as React.ComponentType<any>} />
      <Tabs.Screen name="Tournaments" component={TournamentsScreen as React.ComponentType<any>} />
      <Tabs.Screen name="Leaderboard" component={LeaderboardScreen} />
      <Tabs.Screen name="Profile" component={ProfileScreen} />
    </Tabs.Navigator>
  );
}

export default function App() {
  const { ready, token, restore } = useAuth();

  useEffect(() => {
    void restore();
  }, [restore]);

  useEffect(() => {
    if (!token) {
      disconnectSocket();
      void unloadSounds();
    }
  }, [token]);

  if (!ready) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: C.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={C.green} size="large" />
        <Text style={{ color: C.muted, marginTop: 12 }}>Preparing your board…</Text>
      </View>
    );
  }

  return (
    <NavigationContainer
      theme={{
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          background: C.bg,
          card: C.bg,
          text: C.text,
          border: C.panel,
          primary: C.green,
        },
      }}
    >
      <StatusBar style="light" />
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        {token ? (
          <>
            <Stack.Screen name="Home" component={MainTabs} />
            <Stack.Screen name="Game" component={GameScreen} />
            <Stack.Screen name="TournamentDetail" component={TournamentDetailScreen} />
          </>
        ) : (
          <Stack.Screen name="Auth" component={AuthScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
