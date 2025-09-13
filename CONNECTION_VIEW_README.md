# MSSQL Explorer - Connection View

## New Features

### Dedicated Connection View
- **Professional UI**: A dedicated webview panel for adding connections, similar to the original MSSQL extension
- **Form-based Input**: Clean, organized form with proper validation
- **VS Code Theme Integration**: Automatically adapts to your VS Code theme (light/dark)

### Enhanced Connection Management
- **Test Connection Button**: Test your connection before saving
- **Real-time Validation**: Form validation with helpful error messages
- **Multiple Authentication Methods**: Support for both SQL Server and Windows Authentication
- **Port Configuration**: Specify custom ports (default: 1433)
- **Advanced Options**: Trust server certificate option for self-signed certificates

### Improved Error Handling
- **Detailed Error Messages**: Specific error messages for different connection failures
- **User-friendly Feedback**: Clear indication of what went wrong and how to fix it
- **Connection Status**: Visual feedback during connection testing

## How to Use

### Adding a New Connection
1. **Via Tree View**: Click the "+" button in the CONNECTIONS view
2. **Via Command Palette**: Press `Ctrl+Shift+P` and search for "MSSQL: Add Connection"
3. **Via Command**: Press `Ctrl+Shift+P` and search for "MSSQL: Open Connection View"

### Connection Form Fields
- **Connection Name**: A friendly name to identify the connection
- **Server**: Server name, IP address, or instance name (e.g., `localhost\SQLEXPRESS`)
- **Port**: SQL Server port (default: 1433)
- **Database**: Optional database name (connects to default if not specified)
- **Authentication**: Choose between SQL Server or Windows Authentication
- **Username/Password**: Required for SQL Server Authentication
- **Trust Server Certificate**: Skip certificate validation (useful for self-signed certificates)

### Testing Connections
1. Fill in the connection details
2. Click "Test Connection" to verify the settings
3. If successful, you'll see a green success message
4. If failed, you'll see a detailed error message explaining the issue
5. Fix any issues and test again before saving

### Error Messages
The extension now provides specific error messages for common issues:
- **Connection Refused**: Server not running or incorrect server name
- **Login Failed**: Incorrect username/password
- **Timeout**: Server unreachable or network issues
- **Server Not Found**: Invalid server name or IP address

## Technical Details

### Files Added/Modified
- `connectionView.js`: New dedicated connection view webview
- `commands/connectionCommands.js`: Updated to use the new view
- `connectionManager.js`: Enhanced error handling
- `constants.js`: Added new command constant
- `commands/index.js`: Registered new command

### Dependencies
- Uses VS Code's webview API for the connection form
- Integrates with existing connection management system
- Maintains compatibility with all existing features

## Benefits
- **Better User Experience**: Professional, intuitive interface
- **Reduced Errors**: Test connections before saving
- **Clear Feedback**: Detailed error messages help troubleshoot issues
- **Consistent UI**: Matches VS Code's design language
- **Flexible Configuration**: Support for various connection scenarios
