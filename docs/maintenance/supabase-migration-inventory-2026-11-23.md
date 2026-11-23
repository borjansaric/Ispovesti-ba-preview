# Supabase migration inventory — 2026-11-23

> **Audit snapshot only.** This file records the migration versions reported by the Ispovesti.ba Supabase project on 2026-11-23. It is not executable SQL and must not be used to replay or reset the database.

## Findings

- Supabase reports **57** applied migration records, from `20261024091501` through `20261123092904`.
- The preview repository currently has only one tracked SQL migration source file: `supabase/migrations/20261122105812_reply_notifications_v1.sql`.
- This inventory does not reconstruct the missing historical SQL. Do not fabricate migration files or apply an inferred baseline to the existing database.
- The `reply_notifications_v1` migration is followed in the database history by `remove_test_reply_notifications`. Read-only inspection found no current `community_test.reply_notifications` table, `community_test.notify_reply_author()` function, or notification trigger.
- No database changes were made during this audit.

## Applied migration registry

| Version | Name |
|---|---|
| 20261024091501 | add_isolated_community_test_v2 |
| 20261024104014 | test_admin_restore_turnstile_activation_scoped |
| 20261024125004 | test_admin_email_verification_with_guarded_cutover |
| 20261024134816 | test_comment_submission_receipt |
| 20261024142108 | test_submission_idempotency |
| 20261025155252 | isolated_chat_test_packages_profiles_and_moderation |
| 20261026004216 | test_chat_room_access_codes_and_comment_tools |
| 20261026140245 | test_room_narrow_anonymous_auth_check |
| 20261026174650 | test_only_one_vote_change |
| 20261030084920 | private_prelaunch_snapshot_20261030 |
| 20261030091817 | live_setup_01_private_tables |
| 20261030091827 | live_setup_02_service_dispatch |
| 20261030091834 | live_setup_03_security |
| 20261030091843 | live_setup_04_email_proof |
| 20261030091854 | live_setup_05_moderation |
| 20261030091915 | live_setup_06_owner_and_submission |
| 20261030092032 | activate_live_publisher_20261030 |
| 20261030093857 | chat_live_core_tables |
| 20261030093858 | chat_live_core_dispatch |
| 20261030093907 | complete_live_chat_room |
| 20261030093908 | complete_live_chat_auth |
| 20261030093909 | complete_live_chat_archive |
| 20261030093944 | verify_live_owner_access_20261030 |
| 20261030093946 | complete_live_admin_recovery |
| 20261030093949 | complete_live_recovery_settings |
| 20261030123547 | finalize_legacy_archive_20261030 |
| 20261030131529 | complete_live_admin_operations_20261030 |
| 20261030132125 | complete_live_direct_banner_20261030 |
| 20261117153719 | daily_highlights_test |
| 20261117170837 | emoji_reactions_test |
| 20261117170950 | emoji_reactions_permissions_test |
| 20261117171051 | emoji_reaction_stats_after_vote_lock_test |
| 20261117171120 | emoji_reaction_lock_to_vote_window_test |
| 20261117191135 | emoji_reaction_first_choice_once_test |
| 20261118084525 | captcha_entry_clearance |
| 20261118160251 | align_test_comment_reactions_to_six_hidden_choices |
| 20261119123437 | show_vote_counts_immediately |
| 20261119151601 | combine_test_submit_security_check |
| 20261119151858 | count_only_successful_community_test_submissions |
| 20261119152114 | scope_duplicate_comments_to_same_confession |
| 20261119160926 | restrict_test_submit_check_execution |
| 20261119163759 | align_live_daily_highlights_and_vote_status |
| 20261121171817 | add_test_feed_reaction_and_comment_sorting |
| 20261121174108 | enable_free_test_chat_access |
| 20261122012241 | chat_public_history_latest_100 |
| 20261122012506 | chat_random_side_on_package_activation |
| 20261122015325 | admin_panel_read_api_v1 |
| 20261122015649 | admin_panel_read_pagination_v1 |
| 20261122090259 | anonymous_visitor_analytics_v1 |
| 20261122090456 | anonymous_visitor_analytics_retention_cleanup |
| 20261122105812 | reply_notifications_v1 |
| 20261122220717 | remove_test_reply_notifications |
| 20261122224016 | add_private_my_confessions_list |
| 20261123091838 | enable_rls_on_community_test_reactions |
| 20261123092128 | global_comment_reaction_winner_test |
| 20261123092555 | admin_reaction_breakdown_stats |
| 20261123092904 | remove_heart_from_test_reaction_options |

## Safe next step

Recover original SQL from trusted backups, prior branches, deployment artifacts, or migration authoring history. Compare recovered source against the current schema before deciding whether to establish a new baseline or restore missing migration history. Any database change requires a separate review and explicit approval.
