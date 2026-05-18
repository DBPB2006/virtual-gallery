pipeline {
    agent any

    stages {

        stage('Clone Repository') {
            steps {
                git branch: 'main',
                url: 'https://github.com/DBPB2006/virtual-gallery.git'
            }
        }

        stage('Verify Docker Installation') {
            steps {
                sh 'docker --version'
                sh 'docker compose version'
            }
        }

        stage('Build Docker Containers') {
            steps {
                sh 'docker compose build'
            }
        }

        stage('Start Application Containers') {
            steps {
                sh 'docker compose up -d'
            }
        }

        stage('Verify Running Containers') {
            steps {
                sh 'docker ps'
            }
        }
    }

    post {

        success {
            echo 'Pipeline executed successfully!'
        }

        failure {
            echo 'Pipeline execution failed!'
        }
    }
}