const path = require('path');
const { CopyRspackPlugin, DefinePlugin, HtmlRspackPlugin } = require('@rspack/core');

module.exports = (_, argv) => {
  const isProduction = argv.mode === 'production';
  const publicPath = isProduction ? '/lottie-preview/' : '/';

  return {
    mode: isProduction ? 'production' : 'development',
    entry: './src/index.tsx',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'static/js/[name].[contenthash:8].js',
      publicPath,
      clean: true,
      assetModuleFilename: 'static/media/[name].[hash:8][ext]'
    },
    performance: {
      hints: false
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.jsx', '.js', '.json']
    },
    experiments: {
      css: true
    },
    module: {
      rules: [
        {
          test: /\.(ts|tsx)$/,
          exclude: /node_modules/,
          use: {
            loader: 'builtin:swc-loader',
            options: {
              jsc: {
                parser: {
                  syntax: 'typescript',
                  tsx: true
                },
                transform: {
                  react: {
                    runtime: 'automatic',
                    development: !isProduction,
                    refresh: false
                  }
                }
              },
              env: {
                targets: isProduction ? 'defaults' : 'last 1 chrome version'
              }
            }
          }
        },
        {
          test: /\.css$/,
          type: 'css'
        },
        {
          test: /\.(png|jpe?g|gif|svg|ico|webp)$/i,
          type: 'asset/resource'
        }
      ]
    },
    plugins: [
      new HtmlRspackPlugin({
        template: './public/index.html',
        publicPath,
        minify: isProduction
      }),
      new CopyRspackPlugin({
        patterns: [
          {
            from: 'public',
            to: '.',
            globOptions: {
              ignore: ['**/index.html']
            }
          }
        ]
      }),
      new DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify(isProduction ? 'production' : 'development'),
        'process.env.PUBLIC_URL': JSON.stringify(publicPath.replace(/\/$/, ''))
      })
    ],
    devServer: {
      host: '127.0.0.1',
      port: 3000,
      historyApiFallback: true,
      hot: true,
      open: false
    }
  };
};
