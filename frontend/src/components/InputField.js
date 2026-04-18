import React, { useState } from 'react';
import { View, TextInput, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';
import { SPACING } from '../theme/spacing';
import { FONTS, TYPOGRAPHY } from '../theme/typography';

export default function InputField({ 
  label, 
  value, 
  onChangeText, 
  placeholder, 
  secureTextEntry = false, 
  keyboardType = 'default', 
  autoCapitalize = 'none',
  icon,
  error,
  errorMessage
}) {
  const [focused, setFocused] = useState(false);
  const [isSecure, setIsSecure] = useState(secureTextEntry);

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[
        styles.inputContainer,
        focused && styles.inputFocused,
        (error || errorMessage) && styles.inputError
      ]}>
        {icon && (
          <Feather name={icon} size={20} color={COLORS.muted} style={styles.icon} />
        )}
        <TextInput
          style={[
            styles.input,
            !icon && { paddingLeft: SPACING.medium }
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={COLORS.muted}
          secureTextEntry={isSecure}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {secureTextEntry && (
          <TouchableOpacity onPress={() => setIsSecure(!isSecure)} style={styles.rightIcon} activeOpacity={0.7}>
            <Feather name={isSecure ? "eye-off" : "eye"} size={20} color={COLORS.muted} />
          </TouchableOpacity>
        )}
      </View>
      {errorMessage ? (
        <View style={styles.errorContainer}>
           <Feather name="alert-circle" size={14} color={COLORS.error} />
           <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.medium,
  },
  label: {
    ...TYPOGRAPHY.label,
    color: COLORS.muted,
    marginBottom: SPACING.small,
    textTransform: 'uppercase',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    backgroundColor: COLORS.background, // Match the dark background
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.surface2,
  },
  inputFocused: {
    borderColor: COLORS.gold,
  },
  inputError: {
    borderColor: COLORS.error,
  },
  icon: {
    marginLeft: SPACING.medium,
    marginRight: 4,
  },
  rightIcon: {
    paddingHorizontal: SPACING.medium,
    height: '100%',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontFamily: FONTS.regular,
    fontSize: TYPOGRAPHY.body.fontSize,
    height: '100%',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.small,
  },
  errorText: {
    ...TYPOGRAPHY.label,
    color: COLORS.error,
    marginLeft: 6,
    textTransform: 'none',
  }
});
