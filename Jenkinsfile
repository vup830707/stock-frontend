pipeline {
  agent none

  stages {
    stage('CI - Build Frontend') {
      agent {
        docker {
          image 'node:20-alpine'
          args '-u root:root'
          reuseNode true
        }
      }
      steps {
        sh 'node -v'
        sh 'npm -v'
        sh 'npm ci'
        sh 'npm run build'
      }
    }

    stage('CD - Deploy Frontend') {
      agent { label 'windows' }
      steps {
        bat '''
          docker --version
          docker compose version
          docker compose up -d --build --force-recreate frontend
        '''
      }
    }
  }
}
