#!/bin/bash

# Setup MailHog for email verification in development

echo "Setting up MailHog for email verification..."

# Check if MailHog is already installed
if command -v mailhog &> /dev/null; then
    echo "✓ MailHog is already installed"
else
    echo "Installing MailHog..."
    
    # Check for Homebrew (macOS)
    if command -v brew &> /dev/null; then
        echo "Installing MailHog via Homebrew..."
        brew install mailhog
    # Check for Docker
    elif command -v docker &> /dev/null; then
        echo "MailHog not found. You can run it with Docker:"
        echo "  docker run -d -p 1025:1025 -p 8025:8025 --name mailhog mailhog/mailhog"
        echo ""
        echo "Or install via Homebrew: brew install mailhog"
        exit 1
    else
        echo "Please install MailHog manually:"
        echo "  macOS: brew install mailhog"
        echo "  Linux: Download from https://github.com/mailhog/MailHog/releases"
        echo "  Docker: docker run -d -p 1025:1025 -p 8025:8025 mailhog/mailhog"
        exit 1
    fi
fi

echo ""
echo "✓ MailHog setup complete!"
echo ""
echo "To start MailHog, run:"
echo "  mailhog"
echo ""
echo "Then access the web UI at: http://localhost:8025"
echo "SMTP server will be available at: localhost:1025"


