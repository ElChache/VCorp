/**
 * VCorp Configuration
 * Centralized configuration for the application
 */

export const CONFIG = {
  /**
   * Message length limits
   */
  MESSAGE_LIMITS: {
    /**
     * Maximum allowed length for channel messages (in characters)
     * This prevents verbose messages from cluttering channels
     * Set to 400 to allow reasonable message length while preventing verbosity
     */
    MAX_CHANNEL_MESSAGE_LENGTH: 400,
    
    /**
     * Maximum allowed length for direct messages (in characters)
     * DMs can be slightly longer for detailed discussions
     */
    MAX_DIRECT_MESSAGE_LENGTH: 500,
    
    /**
     * Maximum allowed length for document content (in characters)
     * Documents can be much longer as they contain detailed information
     */
    MAX_DOCUMENT_LENGTH: 10000,
  },
  
  /**
   * Communication settings
   */
  COMMUNICATION: {
    /**
     * Default message priority
     */
    DEFAULT_PRIORITY: 'medium' as const,
    
    /**
     * Polling interval for real-time updates (in milliseconds)
     */
    POLLING_INTERVAL: 5000,
  },

  /**
   * Terminal logging settings
   */
  TERMINAL_LOGGING: {
    /**
     * Enable terminal session logging
     */
    ENABLED: true,
    
    /**
     * Directory where terminal logs are stored
     */
    LOG_DIR: '/tmp/vcorp_terminal_logs',
    
    /**
     * How often to capture terminal output (in milliseconds)
     */
    CAPTURE_INTERVAL: 5000,
    
    /**
     * Maximum log file size before rotation (in bytes)
     */
    MAX_LOG_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    
    /**
     * Number of rotated log files to keep
     */
    MAX_LOG_FILES: 10,
    
    /**
     * Log file name pattern
     * {agentId} and {timestamp} will be replaced
     */
    LOG_FILE_PATTERN: 'terminal_{agentId}_{date}.log',
  },
} as const;

export type ConfigType = typeof CONFIG;