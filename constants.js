// Extension constants and configuration
const EXTENSION_CONFIG = {
    // Extension metadata
    EXTENSION_NAME: 'mssql-explorer',
    EXTENSION_DISPLAY_NAME: 'MSSQL Explorer',
    
    // View IDs
    VIEW_ID: 'mssqlExplorer',
    
    // Command IDs
    COMMANDS: {
        ADD_CONNECTION: 'mssql-explorer.addConnection',
        OPEN_CONNECTION_VIEW: 'mssql-explorer.openConnectionView',
        EDIT_CONNECTION: 'mssql-explorer.editConnection',
        DELETE_CONNECTION: 'mssql-explorer.deleteConnection',
        CONNECT: 'mssql-explorer.connect',
        DISCONNECT: 'mssql-explorer.disconnect',
        REFRESH: 'mssql-explorer.refresh',
        PREVIEW_DATA: 'mssql-explorer.previewData',
        COPY_TABLE_NAME: 'mssql-explorer.copyTableName',
        OPEN_OBJECT: 'mssql-explorer.openObject',
        FILTER_GROUP: 'mssql-explorer.filterGroup',
        CLEAR_GROUP_FILTER: 'mssql-explorer.clearGroupFilter',
        FILTER_DATABASE: 'mssql-explorer.filterDatabase',
        CLEAR_DATABASE_FILTER: 'mssql-explorer.clearDatabaseFilter',
        OPEN_FILTER_RESULTS: 'mssql-explorer.openFilterResults',
        ADD_QUERY: 'mssql-explorer.addQuery',
        EDIT_QUERY: 'mssql-explorer.editQuery',
        DELETE_QUERY: 'mssql-explorer.deleteQuery',
        EXECUTE_QUERY: 'mssql-explorer.executeQuery',
        SELECT_DATA_WITH_OPTIONS: 'mssql-explorer.selectDataWithOptions',
        OPEN_TEST_VIEW: 'mssql-explorer.openTestView'
    },
    
    // Context values
    CONTEXT_VALUES: {
        CONNECTION: 'connection',
        CONNECTIONS: 'connections',
        BOOKMARKED: 'bookmarked',
        SAVED_QUERY: 'savedQuery',
        DATABASE: 'database',
        DATABASE_FILTERED: 'databaseFiltered',
        TABLES: 'tables',
        TABLES_FILTERED: 'tablesFiltered',
        VIEWS: 'views',
        VIEWS_FILTERED: 'viewsFiltered',
        PROCEDURES: 'procedures',
        PROCEDURES_FILTERED: 'proceduresFiltered',
        FUNCTIONS: 'functions',
        FUNCTIONS_FILTERED: 'functionsFiltered',
        INFO: 'info'
    },
    
    // Default connection configuration
    DEFAULT_CONNECTION: {
        driver: 'msnodesqlv8',
        options: {
            trustedConnection: false,
            trustServerCertificate: true
        }
    },
    
    // Grid viewer settings
    GRID_VIEWER: {
        MAX_ROWS: 1000,
        MAX_CELL_LENGTH: 100
    }
};

module.exports = { EXTENSION_CONFIG };
