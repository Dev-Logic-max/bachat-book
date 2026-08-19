import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { RefreshCw, TriangleAlert, WifiOff, X } from 'lucide-react-native';
import { useOfflineQueue } from '../hooks/use-offline-queue';
import { usePalette } from '../providers/theme-provider';
import { Card } from './ui/Surfaces';
import { Button } from './ui/Button';
import { T } from './T';
import { radii, spacing, typography } from '../theme/tokens';

/**
 * What has not reached the server yet.
 *
 * A failed write is never auto-discarded and never retried forever — after five
 * attempts it lands here with the real error and the user chooses. A queue that
 * silently retries a row the server will never accept fills up with a write
 * nobody can see or clear; one that silently drops it loses an expense the user
 * watched themselves type.
 */
export function UnsyncedBanner() {
  const palette = usePalette();
  const { pendingCount, failedCount, failedRows, drain, retry, discard } = useOfflineQueue();
  const [showDetail, setShowDetail] = useState(false);

  const total = pendingCount + failedCount;
  if (total === 0) return null;

  const hasFailures = failedCount > 0;

  return (
    <>
      <Pressable
        onPress={() => (hasFailures ? setShowDetail(true) : drain())}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing.md,
          backgroundColor: hasFailures ? palette.lossSoft : palette.warnSoft,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md - 2,
          borderRadius: radii.full,
          borderWidth: 1,
          borderColor: hasFailures ? palette.loss : palette.borderStrong,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }}>
          {hasFailures ? (
            <TriangleAlert size={16} color={palette.loss} />
          ) : (
            <WifiOff size={16} color={palette.warn} />
          )}
          <Text
            style={{
              fontSize: typography.fontSize.xs,
              fontWeight: '600',
              color: hasFailures ? palette.loss : palette.foreground,
              flexShrink: 1,
            }}
            numberOfLines={1}
          >
            {hasFailures
              ? `${failedCount} could not be saved — tap to fix`
              : `${pendingCount} waiting for signal`}
          </Text>
        </View>

        {!hasFailures ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              backgroundColor: palette.brass,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.xs + 1,
              borderRadius: radii.full,
            }}
          >
            <RefreshCw size={13} color={palette.navy900} strokeWidth={2.5} />
            <Text style={{ fontSize: 11, fontWeight: '700', color: palette.navy900 }}>Retry</Text>
          </View>
        ) : null}
      </Pressable>

      <Modal visible={showDetail} transparent animationType="slide" onRequestClose={() => setShowDetail(false)}>
        <View style={{ flex: 1, backgroundColor: palette.scrim, justifyContent: 'flex-end' }}>
          <View
            style={{
              backgroundColor: palette.canvas,
              borderTopLeftRadius: radii.modal,
              borderTopRightRadius: radii.modal,
              paddingTop: spacing.xl,
              paddingHorizontal: spacing.lg,
              paddingBottom: spacing.xxxl,
              maxHeight: '80%',
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: spacing.lg,
              }}
            >
              <T
                style={{
                  fontSize: typography.fontSize.xl,
                  fontWeight: '700',
                  color: palette.foreground,
                }}
              >
                Could not be saved
              </T>
              <Pressable onPress={() => setShowDetail(false)} hitSlop={10}>
                <X size={21} color={palette.foreground2} />
              </Pressable>
            </View>

            <T
              style={{
                fontSize: typography.fontSize.sm,
                color: palette.muted,
                marginBottom: spacing.lg,
                lineHeight: 20,
              }}
            >
              These are still on this phone and have not reached the server. Nothing is lost until
              you discard it.
            </T>

            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              <View style={{ gap: spacing.md }}>
                {failedRows.map((row) => (
                  <Card key={row.id} tier="nested" style={{ gap: spacing.sm }}>
                    <Text
                      style={{
                        fontSize: typography.fontSize.xs,
                        fontWeight: '700',
                        color: palette.foreground2,
                      }}
                    >
                      {row.action} · {row.table_name}
                    </Text>
                    {/* The REAL error, not a friendly substitute. "Something went
                        wrong" gives the user nothing to act on and hides the one
                        detail that would explain it — a locked account, a
                        read-only workspace, an expired session. */}
                    <Text style={{ fontSize: typography.fontSize.sm, color: palette.loss }}>
                      {row.error || 'Unknown error'}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
                      <Button size="sm" title="Try again" onPress={() => retry(row.id)} />
                      <Button
                        size="sm"
                        variant="outline"
                        title="Discard"
                        onPress={() => discard(row.id)}
                      />
                    </View>
                  </Card>
                ))}
              </View>
            </ScrollView>

            <Button
              block
              title="Try all again"
              style={{ marginTop: spacing.lg }}
              onPress={() => retry()}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}
